# Home Planning Dashboard

Mobile-first dashboard for tracking recurring household chores — watering plants, replacing batteries, and the like. See what's due, what's overdue, and reset a task with one click.

## Stack

Vite + React + Tailwind CSS, client-only (localStorage persistence, no backend).

## Development

```bash
npm install
npm run dev       # dev server
npm test          # Vitest unit tests
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Deploy

Static output in `dist/` — deploy to Cloudflare Pages by connecting this repo (build command `npm run build`, output directory `dist`) or via `npx wrangler pages deploy dist`.

## Features

- Task list with recurring intervals (daily / every N days / weekly / monthly / manual)
- One-click "done today" reset, edit, delete, pin, archive
- Tabs: Dzisiaj (today) / Przybliżający się (upcoming 7 days) / Wszystko (all) / Archiwum
- Category filter (Rośliny / Sprzęt / Dom / Zdrowie)
- KPI bar showing % of tasks done today
- Dark mode
