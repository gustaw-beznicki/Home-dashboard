import { createClerkClient } from '@clerk/backend'

let clerkClient = null
export function getClerkClient(env) {
  if (!clerkClient) {
    clerkClient = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    })
  }
  return clerkClient
}

// Clerk proves "this is a real signed-in account" — it does NOT decide who's
// allowed to use this app. That's what the `users` table is for, so household
// membership can be managed from the in-app admin portal instead of Clerk's
// dashboard. A Clerk dev instance stands in for production locally (via
// `wrangler dev`), so there's no separate mock-identity bypass here.
export async function verifyClerkIdentity(request, env) {
  const client = getClerkClient(env)
  const requestState = await client.authenticateRequest(request)
  if (!requestState.isAuthenticated) return null

  const { userId } = requestState.toAuth()
  const user = await client.users.getUser(userId)
  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
  if (!email) return null

  return {
    email,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    clerkUserId: user.id,
  }
}

// Self-provisions the very first user (INITIAL_ADMIN_EMAIL only, and only
// while the table is still empty) so there's a way into the admin portal on
// day one — every subsequent user has to be invited from there.
export async function authorize(identity, env) {
  const existing = await env.DB.prepare(
    'SELECT email, name, role, status FROM users WHERE email = ?'
  )
    .bind(identity.email)
    .first()

  if (existing) {
    if (existing.status !== 'active') return null
    return {
      email: existing.email,
      name: existing.name ?? identity.name ?? null,
      role: existing.role,
    }
  }

  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
  if (count === 0 && env.INITIAL_ADMIN_EMAIL && identity.email === env.INITIAL_ADMIN_EMAIL) {
    await env.DB.prepare(
      `INSERT INTO users (email, name, role, status, clerk_user_id, invited_by)
       VALUES (?, ?, 'admin', 'active', ?, 'bootstrap')`
    )
      .bind(identity.email, identity.name ?? null, identity.clerkUserId ?? null)
      .run()
    return { email: identity.email, name: identity.name ?? null, role: 'admin' }
  }

  return null
}

export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

// Runs before every /api/* handler. Returns { user } on success, or
// { response } with the 401/403 to return directly to the caller.
export async function requireUser(request, env) {
  const identity = await verifyClerkIdentity(request, env)
  if (!identity) {
    return { response: jsonResponse({ error: 'Unauthenticated' }, { status: 401 }) }
  }

  const user = await authorize(identity, env)
  if (!user) {
    return {
      response: jsonResponse(
        { error: 'Not authorized — ask an admin to invite you from the admin portal' },
        { status: 403 }
      ),
    }
  }

  return { user }
}

// Chain after requireUser for routes under /api/admin/*.
export function requireAdmin({ user }) {
  if (user.role !== 'admin') {
    return { response: jsonResponse({ error: 'Admin only' }, { status: 403 }) }
  }
  return {}
}
