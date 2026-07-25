import { requireUser, requireAdmin, jsonResponse, getClerkClient } from './auth.js'
import { handleClerkWebhook } from './webhooks.js'
import * as db from './db.js'

const SIGN_IN_TOKEN_TTL_SECONDS = 60 * 60 // 1 hour — admin-issued one-time sign-in link

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

    // Clerk calls this directly (svix-signed) — not a user session, must
    // bypass requireUser entirely.
    if (pathname === '/api/webhooks/clerk' && method === 'POST') {
      return handleClerkWebhook(request, env)
    }

    const auth = await requireUser(request, env)
    if (auth.response) return auth.response
    const { user } = auth

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

        if (pathname === '/api/admin/invite' && method === 'POST') {
          const body = await request.json()
          if (!body.email) return jsonResponse({ error: 'email is required' }, { status: 400 })
          const role = body.role === 'admin' ? 'admin' : 'member'

          const clerk = getClerkClient(env)
          await clerk.invitations.createInvitation({
            emailAddress: body.email,
            publicMetadata: { role },
          })
          return jsonResponse(await db.inviteUser(env, body.email, role, user.email), {
            status: 201,
          })
        }

        const blockMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(block|unblock)$/)
        if (blockMatch && method === 'POST') {
          const email = decodeURIComponent(blockMatch[1])
          const wantsBlocked = blockMatch[2] === 'block'
          const target = await db.getUserByEmail(env, email)
          if (!target) return jsonResponse({ error: 'Not found' }, { status: 404 })

          if (target.clerk_user_id) {
            const clerk = getClerkClient(env)
            if (wantsBlocked) await clerk.users.banUser(target.clerk_user_id)
            else await clerk.users.unbanUser(target.clerk_user_id)
          }
          await db.setUserStatus(env, email, wantsBlocked ? 'revoked' : 'active')
          return jsonResponse(await db.getUserByEmail(env, email))
        }

        const resetMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/)
        if (resetMatch && method === 'POST') {
          const email = decodeURIComponent(resetMatch[1])
          const target = await db.getUserByEmail(env, email)
          if (!target?.clerk_user_id) {
            return jsonResponse(
              { error: 'User has not accepted their invite yet' },
              { status: 400 }
            )
          }
          const clerk = getClerkClient(env)
          const token = await clerk.signInTokens.createSignInToken({
            userId: target.clerk_user_id,
            expiresInSeconds: SIGN_IN_TOKEN_TTL_SECONDS,
          })
          return jsonResponse({ url: token.url })
        }

        const mfaMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/mfa$/)
        if (mfaMatch && method === 'DELETE') {
          const email = decodeURIComponent(mfaMatch[1])
          const target = await db.getUserByEmail(env, email)
          if (!target?.clerk_user_id) {
            return jsonResponse(
              { error: 'User has not accepted their invite yet' },
              { status: 400 }
            )
          }
          const clerk = getClerkClient(env)
          await clerk.users.disableUserMFA(target.clerk_user_id)
          return new Response(null, { status: 204 })
        }

        const userDetailMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
        if (userDetailMatch && method === 'GET') {
          const email = decodeURIComponent(userDetailMatch[1])
          const target = await db.getUserByEmail(env, email)
          if (!target) return jsonResponse({ error: 'Not found' }, { status: 404 })
          if (!target.clerk_user_id) return jsonResponse({ ...target, twoFactorEnabled: false })

          const clerk = getClerkClient(env)
          const clerkUser = await clerk.users.getUser(target.clerk_user_id)
          return jsonResponse({ ...target, twoFactorEnabled: clerkUser.twoFactorEnabled })
        }
      }

      return jsonResponse({ error: 'Not found' }, { status: 404 })
    } catch (err) {
      return jsonResponse({ error: 'Internal error', message: String(err) }, { status: 500 })
    }
  },
}
