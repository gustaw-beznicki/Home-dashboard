import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

// Same-origin, so no baseURL is needed — the Worker serves both the app and
// /api/auth/*. There's also no publishable key to configure, which is why
// .env.production no longer exists (ADR 0009).
export const authClient = createAuthClient({
  plugins: [adminClient()],
})

export const { useSession, signOut } = authClient

// Google is the only sign-in method. errorCallbackURL is where an uninvited
// account lands: the create.before hook throws, so Better Auth redirects here
// rather than creating a user.
export function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: '/',
    errorCallbackURL: '/?error=not-invited',
  })
}
