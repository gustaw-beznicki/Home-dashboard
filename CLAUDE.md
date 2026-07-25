# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev                 # Vite dev server — frontend only, /api/* is NOT reachable (see below)
npm run dev:worker          # wrangler dev — serves frontend AND Worker + local D1; use for full-stack work
npm test                    # Vitest, single run
npm run test:watch
npm run build               # production build to dist/
npm run db:migrate:local    # apply D1 migrations to the local dev database
npm run db:migrate          # apply D1 migrations to the REMOTE production database
```

Single test file / single test:

```bash
npx vitest run worker/auth.test.js
npx vitest run -t "bootstraps the first user"
```

`npm run dev` has no `/api` proxy configured, so anything touching the API 404s under plain Vite.
Use `npm run dev:worker` (port 8787) for any work involving the Worker, auth, or D1.

## Architecture

One repo, two runtimes, one deploy target. `wrangler.jsonc`'s `assets.run_worker_first: ["/api/*"]`
is what splits them: `/api/*` hits the Worker (`worker/index.js`), everything else is served as a
static asset from `dist/` with SPA fallback. There is no separate API server or hosting provider.

**Authentication vs authorization are deliberately separate** (ADR 0003, ADR 0008). The identity
provider only proves "this is a real signed-in account"; the D1 `users` table is the actual
authorization boundary, managed from inside the app rather than the provider's dashboard.
`worker/auth.js` never trusts a plain email header — it verifies the session server-side.
`authorize()` self-provisions the very first user matching
`INITIAL_ADMIN_EMAIL` (a Cloudflare secret) while the table is empty; after that, every user must be
invited.

`requireUser` runs once at the top of `fetch` for every `/api/*` path, before any routing. It returns
either `{ user }` or `{ response }` — an already-built error `Response` the caller returns directly.
Follow that shape for any further gates (the Clerk branch adds a `requireAdmin` chained after it for
`/api/admin/*`).

Any provider-to-Worker callback (e.g. an identity provider's webhook) must be carved out **ahead of**
that `requireUser` call — such a request carries a signature, not a browser session, so it would 401
forever inside the normal gate and needs its own signature verification instead.

**Task status is always derived, never persisted.** `src/lib/taskLogic.js` computes
`done | due | overdue | inactive` from `interval` + `lastDone` + the current date. Every function
there takes `today` as an explicit argument and never reads the system clock, which is what makes it
testable — keep that property. `Dashboard` re-ticks on an interval plus visibility/focus events so a
phone reopened the next morning doesn't show stale status.

`src/hooks/useTasks.js` applies changes to local state immediately, fires the API call, then merges
the server response or rolls back on failure. Its exported shape is intentionally stable so the
presentational components don't care that a backend exists.

The `completions` table is append-only history (who completed what, when) — `tasks.last_done_by_*`
is only a denormalized cache of the latest row, kept in sync by the `/complete` endpoint. Don't
treat the cache as the source of truth for attribution.

UI copy is Polish. `src/lib/constants.js` holds the category/interval/priority/tab vocabulary and
status→Tailwind class maps as **literal** class strings (not template-interpolated) so Tailwind's
JIT scanner can see them.

## Repo conventions

**Record architectural decisions.** `docs/adl/` is an architecture decision log; the `adr` skill in
`.claude/skills/adr/` has the workflow and template. Any decision with real alternatives and lasting
consequences (auth/infra/deploy model, new dependency, security trade-off) gets a record. Read the
existing ADRs before changing auth, deploy, or hosting — they explain why things are the way they
are.

**Hand manual work back as a runbook.** When something can't be done from here — dashboard config, a
credential only the user holds, live DNS, a destructive production action — the `manual-steps` skill
in `.claude/skills/manual-steps/` covers the format: verify it's genuinely not automatable first,
then an ordered list of exact commands rather than prose.

**`main` is protected — no direct pushes.** Work on a branch, open a PR, merge. This is enforced for
the repo owner too. Note that toggling repo visibility on GitHub can silently strip branch
protection; re-check with `gh api repos/{owner}/{repo}/branches/main/protection` after any such
change.

**Merging to `main` deploys to production.** `.github/workflows/deploy.yml` runs tests, builds,
applies pending D1 migrations, then `wrangler deploy` on every push to `main`. Consequences:

- Migrations must be additive and backward-compatible with the Worker version currently live, since
  they apply before the new code does.
- Never merge auth/config changes whose required secrets or external setup don't exist yet.
- Requires Node 22 (wrangler's minimum) — the workflow pins it.

**`workers_dev: false` in `wrangler.jsonc` must stay.** Cloudflare re-enables the `*.workers.dev`
route on every `wrangler deploy` unless it's explicitly disabled in config. The app is meant to have
exactly one public hostname (ADR 0004).

**D1 can't `ALTER` an existing `CHECK` constraint** — widening one (e.g. adding a `status` value)
requires the create-new-table / copy / drop / rename pattern.

**Secrets and PII never go in `wrangler.jsonc`** (ADR 0005). This repo is public. Non-secret
identifiers (Access AUD/team domain, a Clerk publishable key) are fine as `vars`; anything personal
or credential-like goes through `wrangler secret put`.

## Current migration state

`main` still authenticates via Cloudflare Access (Google SSO). PR #8 replaces it with Clerk plus a
role-gated `/admin` portal (invite, block/unblock, disable a user's MFA, issue one-time sign-in
links). ADR 0008 records that decision and its two accepted limitations: Clerk exposes no per-user
"admin enables MFA" call (disable-only) and no admin-triggered password-reset email (a one-time
sign-in link stands in). Cloudflare Access intercepts at the edge before app code runs, so it and a
Clerk login screen cannot both be live on one hostname — this is a coordinated flip, not a gradual
rollout.

The cutover is blocked on a Clerk production instance and its DNS. Two gotchas found while testing
that branch locally, worth knowing before finishing it:

- The Worker needs **both** `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`. `authenticateRequest()`
  500s with "Publishable key is missing" if only the secret key is set.
- The frontend reads `VITE_CLERK_PUBLISHABLE_KEY` at **build** time, so the CI build needs it too —
  otherwise the bundle ships `publishableKey: undefined` and the login screen breaks.

Local development uses a Clerk **development** instance: `VITE_CLERK_PUBLISHABLE_KEY` in
`.env.local`, `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` in `.dev.vars` (both gitignored).
