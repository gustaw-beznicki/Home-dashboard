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

**Authentication vs authorization are deliberately separate** (ADR 0003, ADR 0008). Clerk only proves
"this is a real signed-in account"; the D1 `users` table is the actual authorization boundary
(`role` + `status`), managed from the in-app admin portal rather than Clerk's dashboard.
`worker/auth.js` never trusts a plain email header — it verifies the session server-side via
`authenticateRequest()`. `authorize()` self-provisions the very first user matching
`INITIAL_ADMIN_EMAIL` (a Cloudflare secret) **only while the table is empty**; after that, every user
must be invited. That empty-table condition is easy to trip over — if a stale row exists, the
bootstrap silently doesn't fire and the account lands as a plain `member`.

`requireUser` runs once at the top of `fetch` for every `/api/*` path, before any routing. It returns
either `{ user }` or `{ response }` — an already-built error `Response` the caller returns directly.
`requireAdmin` chains after it for `/api/admin/*`. Follow that shape for any further gates.

**The Clerk webhook route must stay carved out ahead of `requireUser`** in `worker/index.js`. Clerk
calls it with an svix signature, not a browser session, so it would 401 forever inside the normal
gate — it verifies its own signature instead. It's also the only point a user's Clerk ID becomes
known, which is what flips their row from `pending` to `active`. Because it's a deliberately
unauthenticated public endpoint, `CLERK_WEBHOOK_SIGNING_SECRET` is the only thing preventing a forged
`user.created` from activating an arbitrary email.

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

**Hand manual work back as a runbook file, not a chat message.** When something can't be done from
here — dashboard config, a credential only the user holds, live DNS, a destructive production action
— write the steps to `docs/runbooks/<slug>.md` and reply with just a link. This runs in a terminal,
so mermaid doesn't render and long lists scroll away; a file opens in markdown preview and stays
open beside the dashboard being configured. The `manual-steps` skill in
`.claude/skills/manual-steps/` has the format, including verifying something is genuinely not
automatable before declaring it manual.

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
identifiers (the Clerk publishable key, Access AUD/team domain) are fine as `vars`; anything personal
or credential-like goes through `wrangler secret put`. Current secrets: `CLERK_SECRET_KEY`,
`CLERK_WEBHOOK_SIGNING_SECRET`, `INITIAL_ADMIN_EMAIL`.

**The Clerk publishable key is needed in two places**, and it's easy to set only one:
`wrangler.jsonc` `vars` for the Worker (`authenticateRequest()` 500s with "Publishable key is
missing" without it) *and* `.env.production` for the frontend, which reads
`VITE_CLERK_PUBLISHABLE_KEY` at **build** time. `.env.local` overrides the latter locally, so local
work runs against a Clerk **development** instance while CI builds get the production key.

## Admin portal and its two known gaps

`/admin` is a separate page (not a panel), gated on `role === 'admin'` client-side and enforced
server-side by `requireAdmin` regardless. It can invite users, block/unblock, disable a user's MFA,
and issue one-time sign-in links.

ADR 0008 records two limitations accepted deliberately, because Clerk's API doesn't expose them —
don't treat them as bugs to fix:

- **No per-user "admin enables MFA".** Only `disableUserMFA()` exists. Enabling is user-self-service,
  or an instance-wide "Require MFA" toggle. So the portal offers disable + a read-only status badge,
  not a symmetric toggle.
- **No admin-triggered password-reset email.** `createSignInToken()` — a one-time sign-in link the
  admin relays — stands in for it.

## Cloudflare Access retirement

Clerk replaced Cloudflare Access (Google SSO). Access intercepts at the edge before app code runs, so
it and a Clerk login screen can never both be live on one hostname — the cutover was a coordinated
flip, not a gradual rollout. The Access application is kept configured-but-disabled for a short bake
period as an emergency fallback. Once that's clean, remove `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`
from `wrangler.jsonc` and drop `jose` from `package.json` (nothing imports it now).

## Local development

Uses a Clerk **development** instance, separate from production and needing no DNS setup:
`VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`, `CLERK_SECRET_KEY` + `CLERK_PUBLISHABLE_KEY` +
`CLERK_WEBHOOK_SIGNING_SECRET` in `.dev.vars` (all gitignored). Sign in through Clerk's real dev UI
via `npm run dev:worker` — there's deliberately no mock-identity bypass, since a mock can't exercise
the login screen or admin portal.

To exercise the invite → `pending`→`active` webhook flow locally without configuring a dev endpoint:

```bash
clerk webhooks listen --token "$(clerk webhooks token)" \
  --forward-to http://localhost:8787/api/webhooks/clerk
```
