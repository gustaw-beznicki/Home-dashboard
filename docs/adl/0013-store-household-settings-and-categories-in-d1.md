# Store household settings and categories in D1, dropping the fixed-category CHECK

## Status

Accepted

## Context

The `Logowanie i admin.dc.html` design (the same claude.ai/design project ADR 0010 came from) adds a
third admin surface: **Panel domu**, with four sections — Dom (household name, week start, default
rhythm for new tasks, reminder preferences), Domownicy, Kategorie and Dane domu. Two of those
sections manage state the app previously had nowhere to put:

- Household-wide settings existed only as hard-coded behaviour: Monday-first weekday chips, an
  `everyNDays / 3` default interval in `TaskSheet`, no name for the home anywhere but the brand.
- The category list was a constant in `src/lib/constants.js`, mirrored by a
  `CHECK (category IN ('plants', 'equipment', 'home', 'health'))` on `tasks.category`. The panel's
  Kategorie section lets the household add and remove categories, which a CHECK against four
  literals cannot express, and D1 cannot `ALTER` an existing CHECK.

The alternative was to ship the panel without those two sections (settings client-side in
`localStorage`, categories fixed), but per-browser settings are wrong for a two-person shared app —
the week starts on the same day for both people — and a category editor that can't edit was the
exact "field that silently does nothing" the redesign brief called out about `priority`.

## Decision

Migration `0005_home_settings_categories_open_category.sql`:

- **`home_settings`** — a single-row table (`CHECK (id = 1)`) holding `name`, `week_start`,
  `default_rhythm`, `remind_morning`, `remind_overdue`. Served by `GET /api/home` (any member —
  the dashboard needs the defaults) and `PATCH /api/home` (admin only).
- **`categories`** — `key` (a slug of the label), `label`, `position`, seeded with the four
  built-ins. `GET /api/categories` for everyone; `POST`/`DELETE` admin only. Deleting a category
  reassigns its tasks to `home`, which is therefore not deletable — the fallback bucket must exist.
  The frontend reads the list through `useCategories()` (shared module cache, built-in list as the
  loading/failure fallback); unknown keys render with the neutral `home` tile and icon.
- **`tasks` is rebuilt** (create/copy/drop/rename, the ADR 0006-era pattern from migration 0002)
  to remove the category CHECK — and, since the table was being rebuilt anyway, to drop
  **`priority`**, which the UI stopped collecting, displaying and sorting by in the redesign.
- Reminder toggles are **persisted preferences only** for now: no notification delivery exists yet.
  They are stored so that enabling notifications later is a Worker cron job away, not a schema
  change, and so both people see the same switch state.

Everything remains backward-compatible with the Worker version live while the migration applies
(ADR 0007): the old code never reads `priority` (its INSERT names its columns and relied on the
column default), writes only category values that trivially satisfy the removed CHECK, and knows
nothing of the new tables.

## Consequences

- Task category validation moved from the schema to the clients of the API. The Worker accepts any
  string; the UI only offers keys from `categories`. A junk category written by hand renders as the
  neutral tile and can be re-filed from the task sheet — visible and correctable, same principle as
  the anchorless-interval rule in ADR 0010.
- `week_start` and `default_rhythm` are now *behaviour*, not copy: the rhythm editor orders its
  weekday chips from the configured first day, and a fresh task sheet starts from the configured
  default rhythm anchored on today. Tests assert the new default (`weekly`).
- Dane domu gained real endpoints: `GET /api/export`, `POST /api/archive/empty`,
  `POST /api/history/trim`, and `DELETE /api/home`, which wipes tasks, completions, users and
  Better Auth's identity/session rows. It double-gates: the UI confirms, and the Worker requires
  `{ "confirm": true }` in the body so a stray fetch can't do it.
- Role management (`POST /api/admin/users/:email/role`) refuses to demote the last active
  gospodarz and mirrors the change into Better Auth's `user.role` (the ADR 0009 two-column rule).
