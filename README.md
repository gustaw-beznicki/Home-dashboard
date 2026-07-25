# Home Planning Dashboard

Mobile-first dashboard for tracking recurring household chores — watering plants, replacing batteries, and the like. See what's due, what's overdue, and reset a task with one click.

## Stack

Vite + React + Tailwind CSS frontend, backed by a Cloudflare Worker (`worker/`) with a D1
database for shared, multi-device task state and per-person completion attribution.
Authentication is [Better Auth](https://www.better-auth.com/) running self-hosted inside the same
Worker against D1, with Google as the only sign-in method; authorization is the app's own `users`
table (role + status). No separate auth service, and no per-user cost.
See `docs/adl/` for the architectural decisions behind this setup — start with
[0009](docs/adl/0009-replace-clerk-with-self-hosted-better-auth-on-d1.md), which explains why
Google-only, and why two-factor auth is Google's job rather than this app's.

## Development

```bash
npm install
npm run dev              # frontend dev server
npm run dev:worker        # wrangler dev, for testing the Worker + D1 locally
npm test                  # Vitest unit tests
npm run build             # production build to dist/
npm run preview            # preview the production build
npm run db:migrate:local   # apply D1 migrations to the local dev database
```

`npm run dev` serves the frontend only — `/api/*` isn't reachable under plain Vite, so use
`npm run dev:worker` (port 8787) for anything touching auth, the Worker, or D1.

Local auth needs no separate provider instance: copy `.dev.vars.example` to `.dev.vars`
(gitignored) and fill it in. Google permits `http://localhost:8787/api/auth/callback/google` as a
redirect URI, so local development uses the same OAuth client as production. Sign in through the
real Google flow — there's deliberately no mock-identity bypass, since a mock can't exercise the
login screen or the invite gate.

## Deploy

CI/CD is a GitHub Actions pipeline (`.github/workflows/deploy.yml`): on every push to `main`,
it runs the test suite, builds, applies any pending D1 migrations, then deploys the Worker via
`wrangler deploy`. Deploys require a `CLOUDFLARE_API_TOKEN` repo secret.

## Features

- Task list with recurring intervals (daily / every N days / weekly / monthly / manual)
- One-click "done today" reset, edit, delete, pin, archive
- Tabs: Dzisiaj (today) / Przybliżający się (upcoming 7 days) / Wszystko (all) / Archiwum
- Category filter (Rośliny / Sprzęt / Dom / Zdrowie)
- KPI bar showing % of tasks done today
- Dark mode
