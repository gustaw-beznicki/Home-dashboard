import { requireUser, jsonResponse } from './auth.js'
import * as db from './db.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) {
      // wrangler.jsonc scopes run_worker_first to /api/*, so this shouldn't
      // normally be hit — defensive fallback to static assets regardless.
      return env.ASSETS.fetch(request)
    }

    const auth = await requireUser(request, env)
    if (auth.response) return auth.response
    const { user } = auth

    const { pathname } = url
    const method = request.method

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

      if (pathname === '/api/users' && method === 'GET') {
        return jsonResponse(await db.listUsers(env))
      }

      if (pathname === '/api/users' && method === 'POST') {
        const body = await request.json()
        if (!body.email) return jsonResponse({ error: 'email is required' }, { status: 400 })
        return jsonResponse(await db.addUser(env, body.email, user.email), { status: 201 })
      }

      const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/)
      if (userMatch && method === 'DELETE') {
        await db.revokeUser(env, decodeURIComponent(userMatch[1]))
        return new Response(null, { status: 204 })
      }

      return jsonResponse({ error: 'Not found' }, { status: 404 })
    } catch (err) {
      return jsonResponse({ error: 'Internal error', message: String(err) }, { status: 500 })
    }
  },
}
