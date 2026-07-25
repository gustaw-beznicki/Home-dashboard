# Home Planning Dashboard

Mobile-first dashboard for tracking recurring household chores — watering plants, replacing batteries, and the like. See what's due, what's overdue, and reset a task with one click.

## Stack

Vite + React + Tailwind CSS frontend, backed by a Cloudflare Worker (`worker/`) with a D1
database for shared, multi-device task state and per-person completion attribution.
Authentication is Clerk; authorization is the app's own `users` table (role + status).
See `docs/adl/` for the architectural decisions behind this setup.

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

Local auth needs a Clerk **development** instance (separate from production, no DNS setup
needed): `VITE_CLERK_PUBLISHABLE_KEY` in `.env.local`, `CLERK_SECRET_KEY` +
`CLERK_WEBHOOK_SIGNING_SECRET` in `.dev.vars` (both gitignored).

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
