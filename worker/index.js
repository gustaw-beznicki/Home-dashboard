import { requireUser, requireAdmin, devBypassUser, jsonResponse } from './auth.js'
import { auth } from './betterAuth.js'
import { missingAuthEnv } from './authOptions.js'
import { sendInviteEmail } from './email.js'
import * as db from './db.js'

// Shaped like Better Auth's own /get-session payload so the React client's
// useSession() accepts it unchanged. Dev-only — see devBypassUser.
function fakeSession(user) {
  const now = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString()

  return {
    session: {
      id: 'dev-session',
      token: 'dev-session',
      userId: 'dev-user',
      createdAt: now,
      updatedAt: now,
      expiresAt,
    },
    user: {
      id: 'dev-user',
      email: user.email,
      name: user.name,
      emailVerified: true,
      image: null,
      role: user.role,
      banned: false,
      createdAt: now,
      updatedAt: now,
    },
  }
}

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

    // `npm run dev:no-auth` runs with no Google credentials at all, so this has
    // to be resolved before the configuration check below — otherwise that check
    // would 503 the very mode whose whole purpose is running without them.
    const bypass = devBypassUser(request, env)

    // Fail loudly and legibly if the deploy got ahead of its secrets. The key
    // names go to the log (visible via `wrangler tail`) but not to the response,
    // since this endpoint is reachable by anyone who can reach the app.
    if (!bypass) {
      const missingEnv = missingAuthEnv(env)
      if (missingEnv.length > 0) {
        console.error(`Auth is not configured — missing: ${missingEnv.join(', ')}`)
        return jsonResponse(
          { error: 'Auth is not configured on the server. Check the Worker logs.' },
          { status: 503 }
        )
      }
    }

    // Better Auth owns everything under its basePath — the Google redirect, the
    // OAuth callback, /get-session, sign-out. These are the routes that
    // *establish* a session, so they must be carved out ahead of requireUser or
    // they'd 401 forever. Same slot the Clerk webhook used to occupy.
    //
    // Wrapped: this sits outside the try/catch below, so anything thrown in here
    // would otherwise escape as a bodyless 500 with nothing to debug.
    if (pathname.startsWith('/api/auth/')) {
      // Under the dev bypass there is no session for Better Auth to hand back,
      // so the app would sit on the login screen forever. Answering get-session
      // here keeps the whole bypass server-side: nothing about it is compiled
      // into the browser bundle, so a production build cannot contain a way to
      // skip sign-in.
      if (bypass) {
        if (pathname === '/api/auth/get-session') {
          return jsonResponse(fakeSession(bypass))
        }
        if (pathname === '/api/auth/sign-out') {
          // Nothing to revoke; say so rather than letting Better Auth 400.
          return jsonResponse({ success: true })
        }
      }

      try {
        return await auth.handler(request)
      } catch (err) {
        console.error('Better Auth handler threw', err)
        return jsonResponse({ error: 'Auth error', message: String(err) }, { status: 500 })
      }
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

      // Undo, inside the dashboard's few-second window. Drops the completion
      // row as well as the cache on `tasks` — see undoLatestCompletion.
      if (completeMatch && method === 'DELETE') {
        const task = await db.undoLatestCompletion(env, completeMatch[1])
        if (!task) return jsonResponse({ error: 'Not found' }, { status: 404 })
        return jsonResponse(task)
      }

      if (pathname === '/api/stats/week' && method === 'GET') {
        return jsonResponse(await db.weekStats(env))
      }

      // Household settings. Reading is for everyone — the dashboard needs the
      // default rhythm and week start — but only a gospodarz can change them.
      if (pathname === '/api/home' && method === 'GET') {
        return jsonResponse(await db.getHomeSettings(env))
      }

      if (pathname === '/api/home' && method === 'PATCH') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        const patch = await request.json()
        return jsonResponse(await db.updateHomeSettings(env, patch))
      }

      // "Usuń dom na zawsze". The explicit confirm flag means a stray fetch or
      // replayed request can't wipe the household; the UI double-confirms on
      // top of it.
      if (pathname === '/api/home' && method === 'DELETE') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        const body = await request.json().catch(() => ({}))
        if (body.confirm !== true) {
          return jsonResponse({ error: 'confirm is required' }, { status: 400 })
        }
        return jsonResponse(await db.deleteHomeData(env))
      }

      if (pathname === '/api/categories' && method === 'GET') {
        return jsonResponse(await db.listCategories(env))
      }

      if (pathname === '/api/categories' && method === 'POST') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        const body = await request.json()
        const created = await db.createCategory(env, body.label ?? '')
        if (!created) return jsonResponse({ error: 'label is required' }, { status: 400 })
        return jsonResponse(created, { status: 201 })
      }

      const categoryMatch = pathname.match(/^\/api\/categories\/([^/]+)$/)
      if (categoryMatch && method === 'DELETE') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        const result = await db.removeCategory(env, decodeURIComponent(categoryMatch[1]))
        if (!result) return jsonResponse({ error: 'Not found' }, { status: 404 })
        if (result.error) return jsonResponse(result, { status: 409 })
        return jsonResponse(result)
      }

      if (pathname === '/api/export' && method === 'GET') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        return jsonResponse(await db.exportAll(env))
      }

      if (pathname === '/api/archive/empty' && method === 'POST') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        return jsonResponse(await db.emptyArchive(env))
      }

      if (pathname === '/api/history/trim' && method === 'POST') {
        const adminCheck = requireAdmin({ user })
        if (adminCheck.response) return adminCheck.response
        return jsonResponse(await db.trimHistory(env))
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
            const { name: homeName } = await db.getHomeSettings(env)
            const result = await sendInviteEmail(env, {
              to: body.email,
              invitedByEmail: user.email,
              homeName,
            })
            emailed = result.sent
          } catch {
            // Swallowed on purpose — see above.
          }

          return jsonResponse({ ...invited, emailed }, { status: 201 })
        }

        // Domownik ↔ Gospodarz. Our column is the real gate; Better Auth's
        // user.role is mirrored so its admin plugin keeps agreeing with us
        // (ADR 0009). setUserRole refuses to demote the last active admin.
        const roleMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/role$/)
        if (roleMatch && method === 'POST') {
          const email = decodeURIComponent(roleMatch[1])
          const body = await request.json()
          const role = body.role === 'admin' ? 'admin' : 'member'

          if (email === user.email) {
            return jsonResponse({ error: 'Cannot change your own role' }, { status: 400 })
          }

          const result = await db.setUserRole(env, email, role)
          if (!result) return jsonResponse({ error: 'Not found' }, { status: 404 })
          if (result.error) return jsonResponse(result, { status: 409 })

          await db.syncAuthUserRole(env, email, role)
          return jsonResponse(result.user)
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
