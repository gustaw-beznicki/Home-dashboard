import { requireUser, requireAdmin, jsonResponse } from './auth.js'
import { auth } from './betterAuth.js'
import { sendInviteEmail } from './email.js'
import * as db from './db.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      // wrangler.jsonc scopes run_worker_first to /api/*, so this shouldn't
      // normally be hit — defensive fallback to static assets regardless.
      return env.ASSETS.fetch(request)
    }

    const { pathname } = url
    const method = request.method

    // Better Auth owns everything under its basePath — the Google redirect, the
    // OAuth callback, /get-session, sign-out. These are the routes that
    // *establish* a session, so they must be carved out ahead of requireUser or
    // they'd 401 forever. Same slot the Clerk webhook used to occupy.
    if (pathname.startsWith('/api/auth/')) {
      return auth.handler(request)
    }

    const gate = await requireUser(request, env)
    if (gate.response) return gate.response
    const { user } = gate

    try {
      if (pathname === '/api/whoami' && method === 'GET') {
        return jsonResponse(user)
      }

      if (pathname === '/api/tasks' && method === 'GET') {
        return jsonResponse(await db.listTasks(env))
      }

      if (pathname === '/api/tasks' && method === 'POST') {
        const draft = await request.json()
        return jsonResponse(await db.createTask(env, draft, user), { status: 201 })
      }

      const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
      if (taskMatch && method === 'PATCH') {
        const patch = await request.json()
        const task = await db.updateTask(env, taskMatch[1], patch)
        if (!task) return jsonResponse({ error: 'Not found' }, { status: 404 })
        return jsonResponse(task)
      }

      if (taskMatch && method === 'DELETE') {
        await db.deleteTask(env, taskMatch[1])
        return new Response(null, { status: 204 })
      }

      const completeMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/complete$/)
      if (completeMatch && method === 'POST') {
        const body = await request.json().catch(() => ({}))
        const task = await db.completeTask(env, completeMatch[1], user, body.date)
        if (!task) return jsonResponse({ error: 'Not found' }, { status: 404 })
        return jsonResponse(task)
      }

      // Everything below is admin-only — invite/block/reset/MFA all manage
      // other people's access, so the D1 role column is the real gate here,
      // same principle as the users table already being the real auth gate.
      if (pathname.startsWith('/api/admin/')) {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response

        if (pathname === '/api/admin/users' && method === 'GET') {
          return jsonResponse(await db.listUsers(env))
        }

        // Inviting is purely a D1 write: Better Auth has no notion of this
        // person until their first Google sign-in, and the create.before hook
        // in authOptions.js is what checks this row exists before letting them
        // in. The email is a courtesy — the row is the source of truth, so a
        // mail failure must not fail the invite.
        if (pathname === '/api/admin/invite' && method === 'POST') {
          const body = await request.json()
          if (!body.email) return jsonResponse({ error: 'email is required' }, { status: 400 })
          const role = body.role === 'admin' ? 'admin' : 'member'

          const invited = await db.inviteUser(env, body.email, role, user.email)

          let emailed = false
          try {
            const result = await sendInviteEmail(env, {
              to: body.email,
              invitedByEmail: user.email,
            })
            emailed = result.sent
          } catch {
            // Swallowed on purpose — see above.
          }

          return jsonResponse({ ...invited, emailed }, { status: 201 })
        }

        const blockMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(block|unblock)$/)
        if (blockMatch && method === 'POST') {
          const email = decodeURIComponent(blockMatch[1])
          const wantsBlocked = blockMatch[2] === 'block'
          const target = await db.getUserByEmail(env, email)
          if (!target) return jsonResponse({ error: 'Not found' }, { status: 404 })

          // Our `status` column is what actually locks them out — requireUser
          // re-checks it on every request and cookie caching is off, so the
          // block bites immediately. Better Auth's ban is chained on top to
          // revoke the existing session rows too; it's skipped when they've
          // never signed in, since there's no identity to ban yet.
          const authUserId = await db.getAuthUserIdByEmail(env, email)
          if (authUserId) {
            const body = { userId: authUserId }
            if (wantsBlocked) {
              await auth.api.banUser({ body, headers: request.headers })
            } else {
              await auth.api.unbanUser({ body, headers: request.headers })
            }
          }
          await db.setUserStatus(env, email, wantsBlocked ? 'revoked' : 'active')
          return jsonResponse(await db.getUserByEmail(env, email))
        }
      }

      return jsonResponse({ error: 'Not found' }, { status: 404 })
    } catch (err) {
      return jsonResponse({ error: 'Internal error', message: String(err) }, { status: 500 })
    }
  },
}
