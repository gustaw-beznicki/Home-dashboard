import { env } from 'cloudflare:workers'
import { betterAuth } from 'better-auth'
import { buildAuthOptions } from './authOptions.js'

// Constructed at module scope on purpose. betterAuth() builds every plugin's
// endpoint table and Zod schemas, which is real CPU work — at module scope it's
// charged to the Worker's 1-second startup budget, whereas lazily building it
// inside `fetch` would charge it to a request, and this app runs on Workers Free
// where that budget is 10ms. Getting a binding off `env` is not I/O, and Better
// Auth's context init is lazy, so there's nothing here that needs a request.
//
// `cloudflare:workers` doesn't resolve under Vitest — that's fine, the tests
// mock this module (see worker/auth.test.js) and never load the real one.
export const auth = betterAuth(buildAuthOptions(env))
