// Schema-generation entry point for `npx auth@latest generate`.
//
// The Better Auth CLI introspects the live database to work out which tables
// already exist, and D1 is only reachable from inside a Worker — so the CLI
// can't point at it. This file feeds the CLI the *same* options the Worker uses
// (via buildAuthOptions) but backed by a local SQLite handle, so the emitted DDL
// matches what D1 will get. Both resolve to databaseType 'sqlite'.
//
// Regenerate after any change to worker/authOptions.js that affects the schema
// (adding a plugin, changing rateLimit storage):
//
//   npx auth@latest generate --config ./scripts/auth-schema.mjs \
//     --output migrations/NNNN_better_auth.sql -y
//
// Point DatabaseSync at .wrangler's local D1 file instead of ':memory:' to get
// an incremental migration (ALTER TABLEs) rather than a full CREATE.
import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { buildAuthOptions } from '../worker/authOptions.js'

export const auth = betterAuth(
  buildAuthOptions({
    DB: new DatabaseSync(':memory:'),
    // Values are irrelevant to schema generation, but must be present so the
    // options object builds without throwing.
    BASE_URL: 'http://localhost:8787',
    BETTER_AUTH_SECRET: 'schema-generation-only-not-a-real-secret',
    GOOGLE_CLIENT_ID: 'schema-generation-only',
    GOOGLE_CLIENT_SECRET: 'schema-generation-only',
  })
)
