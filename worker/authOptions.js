import { admin } from 'better-auth/plugins'
import { APIError } from 'better-auth/api'
import * as db from './db.js'

// Better Auth's configuration, split out from the instance itself so the schema
// generator (`scripts/auth-schema.mjs`) can build the *same* options against a
// local SQLite handle. The CLI can't reach D1 — it introspects the database —
// so without this split the generated migration could silently drift from the
// config that's actually deployed.
//
// Deliberately NOT enabled here: emailAndPassword, twoFactor, passkey. Google is
// the only sign-in method and MFA is Google's. See ADR 0009 — briefly, Better
// Auth's 2FA challenge only fires on /sign-in/email|username|phone-number, so
// app-owned TOTP alongside social sign-in would be a bypass, not a second
// factor; and password hashing (scrypt, ~47ms) doesn't fit the Workers Free
// 10ms CPU budget.
// Without these, Better Auth still *constructs* — it only logs a warning — and
// then throws when something actually tries to use the Google provider or sign a
// cookie. That surfaced once as a bodyless 500 on /api/auth/sign-in/social after
// a deploy landed ahead of `wrangler secret put`, which is a miserable thing to
// debug. Check up front instead.
export const REQUIRED_AUTH_ENV = [
  'BASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
]

export function missingAuthEnv(env) {
  return REQUIRED_AUTH_ENV.filter((key) => !env[key])
}

export function buildAuthOptions(env) {
  return {
    // D1 is detected natively by better-auth's Kysely adapter (it duck-types
    // batch/exec/prepare and loads its own D1SqliteDialect). No ORM, no adapter
    // package. Note D1 has no interactive transactions, so multi-row writes
    // here are not atomic.
    database: env.DB,

    // Must be explicit. Request inference is discouraged, and a wrong value
    // breaks OAuth redirect URIs, CSRF origin checks and the cookie Secure flag.
    baseURL: env.BASE_URL,
    basePath: '/api/auth',
    trustedOrigins: [env.BASE_URL],

    // Not just a signing key — also the key for symmetric encryption. Better
    // Auth throws in production if this falls back to its built-in default.
    secret: env.BETTER_AUTH_SECRET,

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // No `hd` (hosted-domain) restriction: the household accounts are on
        // different domains, so it can't be used. The `users` table is the
        // allowlist instead — see the create.before hook below.
      },
    },

    // Only for ban/unban and session revocation. Its `role` column is NOT the
    // authorization gate — `users.role` in our own table is (ADR 0008, 0009).
    // `member` is intentionally undeclared in a `roles` map, so it resolves to
    // no admin permissions; `adminRoles` defaults to ['admin'] already but is
    // stated for clarity.
    plugins: [admin({ defaultRole: 'member', adminRoles: ['admin'] })],

    // Left off (the default). One D1 read per request is immaterial at this
    // scale and it means blocking someone takes effect on their next request
    // rather than up to cookieCache.maxAge later.
    session: { cookieCache: { enabled: false } },

    // The default store is a module-scope Map — per-isolate and lost on isolate
    // recycle, so counters would neither aggregate nor persist across
    // Cloudflare's isolates. D1 is already bound, so use it.
    rateLimit: { storage: 'database' },

    advanced: {
      // Default is x-forwarded-for, which Better Auth deliberately won't trust
      // as a comma-chain. Behind Cloudflare this is the reliable one.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },

    databaseHooks: {
      user: {
        create: {
          // The invite gate. Refusing here stops an uninvited Google account
          // from creating rows in our database; `authorize()` independently
          // refuses it *access*, so a bypass of this hook would mean junk rows
          // rather than an authorization hole.
          //
          // Throwing an APIError rather than returning false is deliberate:
          // false surfaces a generic "unable to create user", while an APIError
          // message reaches the OAuth error redirect.
          before: async (user) => {
            const { allowed, role } = await db.resolveInvite(env, user.email)
            if (!allowed) {
              throw new APIError('FORBIDDEN', {
                message: 'Brak zaproszenia do tej aplikacji',
              })
            }
            // Mirror our role onto Better Auth's user so the admin plugin can
            // authorize its own endpoints. Ordering against the admin plugin's
            // own create.before hook doesn't matter: it returns
            // { role: defaultRole, ...user }, spreading user *after* its
            // default, so whatever we set survives either order.
            return { data: { ...user, role } }
          },
          // Replaces Clerk's user.created webhook: an invited row goes active
          // the moment they actually sign in.
          after: async (user) => {
            await db.activateUser(env, user.email)
          },
        },
      },
    },
  }
}
