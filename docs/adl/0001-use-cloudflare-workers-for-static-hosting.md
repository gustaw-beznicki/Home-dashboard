# Use Cloudflare Workers for static hosting

## Status

Accepted

## Context

The app needed a Cloudflare deploy target. Cloudflare's current "connect a repo" onboarding flow
creates a **Workers** project (deploy command `npx wrangler deploy`), not a classic Pages project.
`wrangler deploy` needs a config file telling it this is a static site — without one, deploy fails
since there's no Worker script to run.

## Decision

Add `wrangler.jsonc` pointing `assets.directory` at the Vite build output (`dist/`), with SPA
fallback routing (`not_found_handling: single-page-application`). Add `wrangler` as a devDependency.

## Consequences

Deploys via Cloudflare's standard Workers path rather than legacy Pages. This also means the
project already has a Worker runtime available, which made it straightforward later to add a real
API backend ([0002](0002-add-cloudflare-worker-backend-with-d1-for-shared-state.md)) instead of
needing a separate migration off Pages.
