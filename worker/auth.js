import { createRemoteJWKSet, jwtVerify } from 'jose'

let jwks = null
let jwksTeamDomain = null

function getJwks(teamDomain) {
  if (!jwks || jwksTeamDomain !== teamDomain) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
    jwksTeamDomain = teamDomain
  }
  return jwks
}

// Cloudflare Access only runs at the edge — `wrangler dev` never sees it, so
// local API testing needs a stand-in identity rather than 403ing on every request.
export async function verifyAccessIdentity(request, env) {
  if (env.ENVIRONMENT === 'development') {
    return { email: env.DEV_MOCK_EMAIL || 'dev@example.com', name: 'Dev User' }
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getJwks(env.CF_ACCESS_TEAM_DOMAIN), {
      issuer: env.CF_ACCESS_TEAM_DOMAIN,
      audience: env.CF_ACCESS_AUD,
    })
    return { email: payload.email, name: payload.name ?? null }
  } catch {
    // Invalid signature, wrong audience, expired token, etc. — treat as unauthenticated.
    return null
  }
}

// Access proves "this is a real Google account" — it does NOT decide who's
// allowed to use this app. That's what the `users` table is for, so household
// membership can be managed from the in-app admin page instead of Cloudflare's
// dashboard. Self-provisions the very first user (INITIAL_ADMIN_EMAIL only,
// and only while the table is still empty) so there's a way in on day one.
export async function authorize(identity, env) {
  const existing = await env.DB.prepare(
    'SELECT email, name, status FROM users WHERE email = ?'
  )
    .bind(identity.email)
    .first()

  if (existing) {
    if (existing.status !== 'active') return null
    return { email: existing.email, name: existing.name ?? identity.name ?? null }
  }

  const { count } = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first()
  if (count === 0 && env.INITIAL_ADMIN_EMAIL && identity.email === env.INITIAL_ADMIN_EMAIL) {
    await env.DB.prepare(
      'INSERT INTO users (email, name, status, invited_by) VALUES (?, ?, ?, ?)'
    )
      .bind(identity.email, identity.name ?? null, 'active', 'bootstrap')
      .run()
    return { email: identity.email, name: identity.name ?? null }
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
  const identity = await verifyAccessIdentity(request, env)
  if (!identity) {
    return { response: jsonResponse({ error: 'Unauthenticated' }, { status: 401 }) }
  }

  const user = await authorize(identity, env)
  if (!user) {
    return {
      response: jsonResponse(
        { error: 'Not authorized — ask an existing user to add you from the admin page' },
        { status: 403 }
      ),
    }
  }

  return { user }
}
