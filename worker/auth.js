import { auth } from './betterAuth.js'
import { syncAuthUserRole } from './db.js'

// Hostnames a local dev server can be reached on. This app has exactly one
// public hostname and `workers_dev: false` keeps it that way (ADR 0004), so no
// deployed request can ever present one of these.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

/**
 * Local-only identity bypass for `npm run dev:no-auth`, so the app can be worked
 * on without Google OAuth credentials. Returns a synthetic user, or null.
 *
 * Two conditions, both required, and the second is the one that matters:
 *
 *   1. `DEV_NO_AUTH` is exactly the string 'true' — nothing else, so no stray '1'
 *      or 'yes' switches it on. Supplied by `wrangler dev --var`, which is why
 *      it never appears in wrangler.jsonc and so cannot reach a deploy.
 *   2. The request arrived on a loopback hostname. Even if (1) were somehow set
 *      in production config, a request to the real hostname cannot satisfy this,
 *      so the bypass is unreachable rather than merely unset.
 *
 * It deliberately does NOT write a `users` row — a bypass is not a grant, and
 * mixing the two would mean running the app locally quietly handed out access.
 * The cost is that this identity doesn't appear in the admin portal's list; use
 * `npm run admin:grant` if you want a real row (ADR 0012).
 *
 * What this cannot exercise, and what still needs a real sign-in: the login
 * screen, the invite gate (`databaseHooks.user.create.before`), and role
 * mirroring into Better Auth's own tables.
 */
export function devBypassUser(request, env) {
  if (env.DEV_NO_AUTH !== 'true') return null
  if (!LOCAL_HOSTNAMES.has(new URL(request.url).hostname)) return null

  const email = env.DEV_USER_EMAIL || 'dev@localhost'
  return {
    email,
    name: env.DEV_USER_NAME || email.split('@')[0],
    // Admin by default, since the point is reaching every screen. Override with
    // `--var DEV_USER_ROLE:member` to check what the admin gate actually hides.
    role: env.DEV_USER_ROLE === 'member' ? 'member' : 'admin',
  }
}

// Better Auth proves "this is a real signed-in account" — it does NOT decide who's
// allowed to use this app. That's what the `users` table is for, so household
// membership can be managed from the in-app admin portal rather than by editing
// identity records. Google is the only sign-in method, so MFA and account
// recovery are Google's (ADR 0009).
//
// `role` on the returned identity is Better Auth's mirrored copy, carried only so
// authorize() can spot drift. It is never used to make an access decision.
export async function verifySession(request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.email) return null

  return {
    email: session.user.email,
    name: session.user.name || null,
    role: session.user.role ?? null,
  }
}

// A row in `users` is the whole rule: no row, no access. There is deliberately
// no self-provisioning path — the first admin is granted out of band with
// `npm run admin:grant` (ADR 0012). The mechanism this replaced granted admin as
// a side effect of a login attempt, gated on the table being empty, which meant
// the escape hatch closed silently after one use and was no help at all to a
// household that later locked itself out.
export async function authorize(identity, env) {
  const existing = await env.DB.prepare(
    'SELECT email, name, role, status FROM users WHERE email = ?'
  )
    .bind(identity.email)
    .first()

  if (existing) {
    if (existing.status !== 'active') return null

    // Keep Better Auth's mirrored role in step with ours. The admin plugin
    // authorizes its own endpoints against its copy, so if the two disagree —
    // most likely because someone edited `users.role` with `wrangler d1
    // execute` — admin API calls would 403 while the portal still rendered.
    // Guarded by mismatch, so this writes almost never.
    if (identity.role != null && identity.role !== existing.role) {
      await syncAuthUserRole(env, existing.email, existing.role)
    }

    return {
      email: existing.email,
      name: existing.name ?? identity.name ?? null,
      role: existing.role,
    }
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
  // Ahead of verifySession on purpose: with no Google credentials configured
  // there is no session to verify, so a bypass placed after it would never run.
  const bypass = devBypassUser(request, env)
  if (bypass) return { user: bypass }

  const identity = await verifySession(request)
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
