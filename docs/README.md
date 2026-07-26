# Technical README

The [root README](../README.md) covers what Ogarniamy is and who it's for. This page is for
running it, testing it, or deploying it.

## Stack

Vite + React + Tailwind CSS frontend, backed by a Cloudflare Worker (`worker/`) with a D1
database for shared, multi-device task state and per-person completion attribution.
Authentication is [Better Auth](https://www.better-auth.com/) running self-hosted inside the same
Worker against D1, with Google as the only sign-in method; authorization is the app's own `users`
table (role + status). No separate auth service, and no per-user cost.

See [`docs/adl/`](adl/README.md) for the architectural decisions behind this setup — start with
[0009](adl/0009-replace-clerk-with-self-hosted-better-auth-on-d1.md), which explains why
Google-only, and why two-factor auth is Google's job rather than this app's.

## Development

```bash
npm install
npm run dev                 # frontend dev server
npm run dev:worker           # wrangler dev, for testing the Worker + D1 locally
npm run dev:no-auth          # wrangler dev with sign-in skipped (loopback only, ADR 0011)
npm run build                # production build to dist/
npm run preview              # preview the production build
npm run db:migrate:local      # apply D1 migrations to the local dev database
npm run db:seed:local         # sample tasks + completion history for local work
```

`npm run dev` serves the frontend only — `/api/*` isn't reachable under plain Vite, so use
`npm run dev:worker` (port 8787) for anything touching auth, the Worker, or D1.

Local auth needs no separate provider instance: copy `.dev.vars.example` to `.dev.vars`
(gitignored) and fill it in. Google permits `http://localhost:8787/api/auth/callback/google` as a
redirect URI, so local development uses the same OAuth client as production. Sign in through the
real Google flow — there's deliberately no mock-identity bypass for that path, since a mock can't
exercise the login screen or the invite gate. See
[`docs/runbooks/local-testing.md`](runbooks/local-testing.md) for a full walkthrough, including
what `dev:no-auth` can't exercise.

## Testing

```bash
npm test                       # Vitest, single run
npm run test:watch             # Vitest, watch mode
npx vitest run worker/auth.test.js         # a single test file
npx vitest run -t "never writes to \`users\`"  # a single test by name
npm run test:e2e               # Playwright end-to-end tests (see e2e/)
```

CI runs `npm test` and `npm run build` on every push and pull request, including from forks
(read-only checkout, no secret access, no deploy) — that's the `test` job in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

## Deploy

CI/CD is a GitHub Actions pipeline (`.github/workflows/deploy.yml`): on every push to `main`, it
runs the test suite, builds, applies any pending D1 migrations, then deploys the Worker via
`wrangler deploy`. Deploys require a `CLOUDFLARE_API_TOKEN` repo secret and only run after the test
job passes.

`main` is protected — no direct pushes, even for the repo owner. Work happens on a branch, through
a pull request; merging to `main` is what triggers a production deploy, so migrations must stay
additive and backward-compatible with whatever Worker version is currently live (they apply before
the new code does).

## Architecture notes

The root `CLAUDE.md` is the living architecture reference for this repo — invariants, gotchas, and
the reasoning behind non-obvious choices (auth split, recurrence model, admin tooling, and so on).
`docs/adl/` is the decision log behind those choices; `docs/runbooks/` holds step-by-step guides
for things that can't be fully automated (auth cutover, local testing, manual admin recovery).

## Features, for reference

- Task list with recurring intervals (daily / every N days / weekly / monthly / manual)
- One-click "done today" reset, edit, delete, pin, archive
- Tabs: Dzisiaj (today) / Przybliżający się (upcoming 7 days) / Wszystko (all) / Archiwum
- Category filter (Rośliny / Sprzęt / Dom / Zdrowie, editable per household)
- KPI bar showing % of tasks done today, plus a weekly per-person completion tally
- Admin portal (`/admin`) and household settings (`/panel`) — see `CLAUDE.md` for the split
- Dark mode
