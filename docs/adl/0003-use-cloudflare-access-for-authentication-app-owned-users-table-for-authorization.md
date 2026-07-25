# Use Cloudflare Access for authentication, an app-owned users table for authorization

## Status

Superseded by [0008](0008-use-clerk-as-managed-identity-provider.md)

## Context

Once the app had a shared backend ([0002](0002-add-cloudflare-worker-backend-with-d1-for-shared-state.md)),
it needed to know who was making each request, both to gate access to household members only and
to attribute task completions correctly. Building a full auth system (password storage, sessions,
account recovery) from scratch is a lot of surface area for a household app, and per-user access
control needs to be app-managed anyway (adding/removing household members over time) rather than
fixed at deploy time.

## Decision

Split the two concerns:
- **Authentication** — Cloudflare Access, Google SSO as the identity provider. Access only proves
  "this is a real Google account"; the Worker (`worker/auth.js`) independently verifies the
  `Cf-Access-Jwt-Assertion` JWT against Cloudflare's JWKS endpoint (issuer + audience checked), it
  never trusts the plain email header alone.
- **Authorization** — a separate app-owned `users` table, managed from an in-app admin page, not
  from Cloudflare's dashboard. A verified Google identity that isn't in that table (or is revoked)
  still gets rejected by the app. The Access application's own policy is deliberately permissive
  (Include: Login Methods = Google, no specific email allowlist) — the app's `users` table is the
  real gate, so household membership changes don't require touching Cloudflare's dashboard.

## Consequences

Adding or removing a household member is an in-app action (admin page), not a Cloudflare Zero Trust
dashboard change. This does mean two systems have to agree for access to work (Access must accept
the sign-in, then the app's `users` table must authorize it), and the Access application's public
hostname must be the only reachable path to the Worker, or the JWT check can be bypassed entirely —
see [0004](0004-attach-custom-domain-disable-workers-dev-to-prevent-access-bypass.md).
