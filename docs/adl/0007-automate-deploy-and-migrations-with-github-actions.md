# Automate deploy and migrations with GitHub Actions

## Status

Accepted

## Context

Deploy already happened automatically via Cloudflare Workers Builds (dashboard-connected-repo,
build command `npm run build`, deploy command `npx wrangler deploy`, triggered on push to `main`).
That pipeline never ran D1 migrations, so every new migration file required manually running
`wrangler d1 migrations apply home-dashboard-db --remote` by hand after merging — easy to forget,
and not reviewable or visible anywhere in the repo.

## Decision

Replace the dashboard-configured Cloudflare Workers Build with a version-controlled GitHub Actions
workflow (`.github/workflows/deploy.yml`): on push to `main`, run tests, build, apply pending D1
migrations, then deploy. A separate `test` job also runs on pull requests (including from forks) —
read-only checkout, no access to the deploy secret, can't trigger a deploy. Node 22 is required
(wrangler 4.114.0's minimum); the deploy job's concurrency is scoped so overlapping pushes queue
rather than run two deploys at once, without blocking PR checks.

## Consequences

Migrations can no longer be forgotten — they're applied automatically as part of every deploy, and
the pipeline is visible and reviewable in the repo itself rather than living only in Cloudflare's
dashboard settings. Requires a `CLOUDFLARE_API_TOKEN` repo secret (scoped to D1 + Workers Scripts
edit) and disabling Cloudflare's dashboard auto-deploy, so the two paths don't race on the same
push. A broken migration correctly blocks deploy (the job fails before reaching `wrangler deploy`),
leaving the previous Worker version live — migrations should stay additive/backward-compatible with
whatever Worker version is currently live, independent of this CI mechanism.
