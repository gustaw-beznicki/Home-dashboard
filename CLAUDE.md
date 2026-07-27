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
npm run db:seed:local       # sample tasks + completion history for local work
npm run admin:list          # who has access; add -- --remote for production
npm run admin:grant -- you@example.com [--role member|--status revoked] [--remote]
```

Single test file / single test:

```bash
npx vitest run worker/auth.test.js
npx vitest run -t "never writes to \`users\`"
```

The UI is `Ogarniamy` — the design system it implements is described in the
`Home Dashboard.dc.html` claude.ai/design project (directions 2a, 2b/3a), with the decisions that
touched data and dependencies recorded in ADR 0010.

`npm run dev` has no `/api` proxy configured, so anything touching the API 404s under plain Vite.
Use `npm run dev:worker` (port 8787) for any work involving the Worker, auth, or D1.

## Architecture

One repo, two runtimes, one deploy target. `wrangler.jsonc`'s `assets.run_worker_first: ["/api/*"]`
is what splits them: `/api/*` hits the Worker (`worker/index.js`), everything else is served as a
static asset from `dist/` with SPA fallback. There is no separate API server or hosting provider.

**Authentication vs authorization are deliberately separate** (ADR 0003, ADR 0009). Better Auth only
proves "this is a real signed-in account"; the D1 `users` table is the actual authorization boundary
(`role` + `status`), managed from the in-app admin portal. `worker/auth.js` never trusts a plain email
header — it verifies the session server-side via `auth.api.getSession()`.

**`authorize()` only ever reads.** A non-revoked `users` row is the entire rule: no row, no access,
and an empty table means nobody gets in. There is no self-provisioning path — the first admin is
granted out of band with `npm run admin:grant -- you@example.com --remote` (ADR 0012). The
`INITIAL_ADMIN_EMAIL` bootstrap this replaced granted admin as a *side effect of a login attempt*,
gated on the table being empty, so the escape hatch closed silently after one use and was no help to a
household that later locked itself out. Don't reintroduce it; `npm run admin:list` and
`admin:grant` cover setup, promotion, demotion, revocation and recovery, against local or production.

`requireUser` runs once at the top of `fetch` for every `/api/*` path, before any routing. It returns
either `{ user }` or `{ response }` — an already-built error `Response` the caller returns directly.
`requireAdmin` chains after it for `/api/admin/*`. Follow that shape for any further gates.

**`/api/auth/*` must stay carved out ahead of `requireUser`** in `worker/index.js` — those are the
routes that *establish* a session (Google redirect, OAuth callback, `get-session`, sign-out), so
inside the normal gate they'd 401 forever. Same slot the retired Clerk webhook used to occupy.

**Better Auth is constructed at module scope**, in `worker/betterAuth.js`. That is not incidental:
`betterAuth()` builds every plugin's endpoint table and Zod schemas, which at module scope is charged
to the Worker's 1-second startup budget, whereas building it lazily inside `fetch` would charge it to
a request — and this app runs on **Workers Free, where that budget is 10 ms**. Don't "optimise" it
into a lazy singleton. `env` from `cloudflare:workers` is genuinely populated at module scope for vars
and secrets (only binding *methods* are unavailable there), which is verified: the generated Google
redirect URI reflects `BASE_URL`. Note `wrangler check startup` runs without bindings and so logs
spurious "Base URL is not set" warnings — those do not appear under `wrangler dev` or in production.

**Config lives in `worker/authOptions.js`, not `betterAuth.js`.** The split exists so
`scripts/auth-schema.mjs` can build the *same* options against a local SQLite handle for
`npx auth@latest generate` — the Better Auth CLI introspects the database and can't reach D1. Change
options in one place and the generated migration stays truthful. Regenerate after any schema-affecting
change (new plugin, rate-limit storage).

**There are two `role` columns and they must agree.** Ours (`users.role`) is the real gate. Better
Auth's (`user.role`) exists only so the `admin` plugin can authorize its own endpoints, and is
mirrored from ours by the `user.create.before` hook, with a mismatch-guarded repair in `authorize()`.
Editing `users.role` directly with `wrangler d1 execute` will 403 admin API calls until that repair
runs. `worker/db.js`'s `getAuthUserIdByEmail` / `syncAuthUserRole` are the only code that touches
Better Auth's tables directly; everything else goes through `auth.api.*`.

**The invite gate is a DB hook, not a webhook.** `databaseHooks.user.create.before` refuses to create
an identity for any email without a `users` row, and
`create.after` flips `pending` → `active`. It throws an `APIError` rather than returning `false`,
because `false` surfaces a generic "unable to create user" while an `APIError` message reaches the
OAuth error redirect. Treat it as hygiene, not the security boundary — `authorize()` is what actually
denies access, so a bypassed hook means junk rows, not an authorization hole.

**Two settings are deliberate and load-bearing.** `session.cookieCache` is **off**, so blocking a user
bites on their next request instead of up to `maxAge` later (and it avoids the interaction behind
advisory GHSA-xg6x-h9c9-2m83). `rateLimit.storage` is `'database'`, because the default store is a
module-scope `Map` — per-isolate and lost on isolate recycle, so counters would neither aggregate nor
persist across Cloudflare's isolates.

**Better Auth's schema is camelCase** (`emailVerified`, `banExpires`), unlike `users`/`tasks`/
`completions`. Its `date` columns hold ISO-8601 TEXT and booleans hold integer 0/1, so don't add CHECK
constraints to them. The version is **pinned exactly** — minors ship breaking changes every 4–6 weeks,
and because migrations apply before the new Worker deploys (ADR 0007), a schema-changing bump needs a
two-step deploy rather than one merge.

**Task status is always derived, never persisted.** `src/lib/recurrence.js` computes
`done | due | overdue | later` from `interval` + `lastDone` + the current date. Every function there
takes `today` as an explicit argument and never reads the system clock, which is what makes it
testable — keep that property. `Dashboard` re-ticks on an interval plus visibility/focus events so a
phone reopened the next morning doesn't show stale status.

**Recurrence hangs off an anchor, not off the last completion** (ADR 0010). Every non-manual
interval carries `startsOn`, an ISO date defining a *grid* of deadlines; the next deadline is the
first grid point strictly after `lastDone`. So paying a bill three days late does not move the bill
to the 4th of every month, and "co miesiąc" means a calendar month rather than 30 days. The corollary
is that `interval.startsOn` is never optional in the UI — `RhythmEditor` always shows rhythm and
"od kiedy" together, because the grid is meaningless without it. A recurring interval that somehow
reaches `computeStatus` with no anchor is reported `overdue` on purpose: visible and correctable
beats silently invisible.

**The anchor means "not before this", not "the first deadline"** (ADR 0015). The first deadline is the
first grid point *on or after* `startsOn`, which is why `firstOnGrid` exists. Returning the anchor
verbatim used to fire one occurrence no rule had asked for — "co miesiąc, pierwszego" anchored on the
27th previewed `27.07 → 01.09 → 01.10`. Daily and `everyNDays` need no snapping; they are grid point
zero.

**Yearly is `monthly` with a unit, not its own type** (ADR 0015). Intervals are
`{ type: 'monthly', every, unit: 'month' | 'year', day, startsOn }`, and a year is read as
`every * 12` months so both units share one code path — which is also what makes 29 February clamp
correctly with no special case. `interval_type` carries a `CHECK` constraint D1 can't `ALTER`, so a
real `yearly` type would have meant the whole table-rebuild dance for a tidier discriminant and
nothing else. Absent `every`/`unit` read as `every: 1, unit: 'month'`, which is what every pre-0008
row is. **With `unit: 'year'` there is no day rule** — the anchor holds the month and the day, the
editor hides that panel, and `intervalColumns` clears `interval_day` so a leftover rule can't
contradict the anchor. Keep `intervalKey` normalising both fields: without it a pre-0008 row wouldn't
compare equal to the same rhythm rebuilt by the editor, and the sheet would ask about a rebase nobody
requested.

Changing an interval on an already-completed task visibly moves its next deadline, so the editor asks
which base to count from (`rebaseInterval`). Don't add a code path that changes an interval without
that choice.

**`RhythmEditor` asks three questions in one order: rhythm → last completion → anchor.** Each answer
narrows the next, which is why "Ostatnio zrobione" lives in the editor rather than further down the
sheet. The preview uses `upcomingForTask`, counted from the completion, so it shows the deadlines *this
task* has rather than the grid seen from today — otherwise the preview says "1 sierpnia" while the card
calls the same task overdue since 1 July. The anchor offers "od ostatniej daty" once there is one, and
"inna data" reveals a **visible** date field: it used to be a `<label>` wrapping an `sr-only`
`<input type="date">`, which did nothing at all, because browsers open the picker only from the
calendar indicator or `showPicker()`. Don't put a date input behind `sr-only` again — jsdom cannot
catch it, which is why there is an e2e case for it.

`groupTasks` and `filterForView` split responsibilities: the view filter decides *which* tasks
(including archived), the grouper decides *which stop* — pass `groupTasks` an already-filtered list.
A task ticked off today keeps its place via the sticky-group map in `Dashboard`'s `useUndoWindow`,
then settles into `DoneToday` when the undo window closes.

**The day strip is navigation, not decoration** (ADR 0017). A bar filters the list to the day it
counted — `filterByDay` uses the same `dueDate` test as `dayLoad`, so the drill-down and the number
above the bar cannot disagree — and the arrows page `dayLoad`'s window by a week through an `offset`,
with `isToday`/`overdue` still measured against the real today. Two consequences to keep: a thing
ticked off today is filed under its *next* deadline, so today's bar empties as the day is cleared (the
bars count work, not history); and the way back to today sits *beside* the range caption, never in
place of the forward arrow — replacing it made a second week forward unreachable, and there is a test
for that. `DoneToday` and the reward are suppressed while a day is selected, since both summarise today
as a whole.

**Two of the four views are flat, and `upcoming` is flat for a reason worth knowing.** *Najbliższy
tydzień* asks *when does this next fall due* — nothing else. So it filters on `daysUntilDue`
(`0 < until <= 7`) rather than on `status === 'later'`, sorts with `sortByNextDue` rather than
`sortByUrgency`, and renders every card as the quiet tier via `TaskCard`'s `renderAs`. Each of those
three is a fix for the same wrong instinct — that today's status can stand in for a future date. It
can't: anything ticked off today reads `done`, so the status filter dropped a daily chore done this
morning out of the coming week entirely (the day strip drew a bar for tomorrow while the view said "Tu
nic nie ma"), urgency sorting put "za tydzień" above "za 3 dni" because the statuses were mixed, and
the card rendered a strikethrough and "cofnij" where a date belonged. `DoneToday` and the day-complete
reward are both suppressed there for the same reason — they are about today, and that view isn't.

**The day has a progress bar again, and it is not the one that was removed** (ADR 0016). `dayProgress`
measures *today* — what fell due today or earlier, with the already-ticked-off kept in the
denominator, so the bar climbs from `0 z 6` to `6 z 6` instead of dividing by a backlog and barely
moving. It always shows the count beside the percentage, an empty day reads 100% rather than 0%, and a
"na spokojnie" thing ticked off early is excluded via the sticky map — count it and the tap that gets
ahead of the week would send the percentage backwards. `DayProgress` lives on the hero card only: its
two colours are measured against a surface that is dark in **both** themes, so they are literals, not
theme roles that flip.

**`DayComplete` stands above the completions, never in their place.** The guard is `dayClosed`, and it
tests for a *visible* completion rather than for a non-empty list — a list holding only "Na spokojnie"
is non-empty with nothing to take back. `EmptyState` is suppressed while it shows: "Na dziś nic" is for
a day that never had anything on it and undercuts the reward for a day that did. The falling leaves are
removed outright under `prefers-reduced-motion` (`[data-leaf]`), not slowed down, and `playKey` is what
keeps the celebration playing once.

**Two affordances split the day, and both are needed** (ADR 0016). The sticky map holds a completion
*in place* for `UNDO_WINDOW_MS` so the list doesn't reshuffle under the thumb that just tapped it; when
that window closes it settles into `DoneToday` ("Zrobione dziś") rather than leaving the page, and
"cofnij" keeps working until midnight. Shipping the reward with only the sticky groups was a mistake
that no test caught: after a reload the hero read "4 z 4 · 100%" above "Na dziś nic", with the day's
work gone from the page. `DoneToday` excludes anything still sticky, so nothing appears twice.

`src/hooks/useTasks.js` applies changes to local state immediately, fires the API call, then merges
the server response or rolls back on failure. Its exported shape is intentionally stable so the
presentational components don't care that a backend exists. A failed write is also *remembered*, as
`rollback: { id, name, retry }`, because the card's one-second flash outlives nothing while the lost
change outlives everything — and `retry` re-fires that same write rather than refetching, or the
banner's "Ponów" would be a lie. Adding a thing doesn't go through `mutate`, so it has no card to name
and keeps the older flat message.

The `completions` table is append-only history (who completed what, when) — `tasks.last_done_by_*`
is only a denormalized cache of the latest row, kept in sync by the `/complete` endpoint. Don't
treat the cache as the source of truth for attribution; `GET /api/stats/week` reads the history
directly because the cache would undercount anything done twice in a week. The one thing that *does*
delete history is `DELETE /api/tasks/:id/complete`, backing the few-second undo — it drops the newest
row and recomputes the cache from what remains.

UI copy is Polish and lives in `COPY` in `src/lib/constants.js`, which also holds the category /
rhythm / view vocabulary and the status→Tailwind class maps as **literal** class strings (not
template-interpolated) so Tailwind's scanner can see them. That still matters on Tailwind 4, which has
no `content` array to widen — it auto-scans the project, and a class assembled by template
interpolation is invisible to it just as before.

**Design tokens live in `@theme` in `src/index.css`, not in a config file.** Tailwind 4 is CSS-first,
so there is no `tailwind.config.js` — colours, radii (`card`/`hero`/`sheet` = 22/26/28 px), the
`ease-sheet` curve and the keyframes are all `--*` custom properties there. The 4.5 / 5.5 / 6.5
spacing rungs are *gone as custom values* and did not need replacing: v4 derives fractional spacing
from `--spacing` (0.25rem), so `px-4.5` computes to the same 18 px it always did. PostCSS runs
`@tailwindcss/postcss`, and `autoprefixer` is no longer a dependency — v4 handles prefixing itself.

**Colour never carries status on its own.** Every status also has a marker *shape* (square / filled
circle / hollow circle), a card treatment, and a word. Icons are `lucide-react` at stroke 1.8, and
there are deliberately no emoji anywhere in the UI.

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

**PR descriptions come from the `pr-description` skill — always.** Never hand-write a body for
`gh pr create` / `gh pr edit`: the skill (`/pr-description`, in `~/.claude/commands/`) inspects the
actual diff, captures light/dark screenshots for UI changes via `scripts/screenshot-pr.mjs` and
commits them on the branch, and produces the required template (What changed / Why / How to test /
Screenshots / Checklist). A PreToolUse hook in `.claude/settings.json` reminds about this whenever a
`gh pr create|edit` command runs; treat the reminder as a stop sign, not a suggestion.

**`main` is protected — no direct pushes.** Work on a branch, open a PR, merge. This is enforced for
the repo owner too. Note that toggling repo visibility on GitHub can silently strip branch
protection; re-check with `gh api repos/{owner}/{repo}/branches/main/protection` after any such
change.

**Merged branches are deleted automatically** (`delete_branch_on_merge`).

**PR screenshots are release assets, never commits** — with exactly one exception, the README's
product shot in `docs/img/`. That one is documentation with the lifespan of the project, not a review
artefact, so it is committed deliberately; `docs/screenshots/` is gitignored as a backstop and
`screenshot-pr.mjs` defaults its output to the system temp directory. Review screenshots go on a
`pr-<N>-images` **prerelease**
(`gh release create … --prerelease`), and the body links
`github.com/<owner>/<repo>/releases/download/pr-<N>-images/<file>.png`. GitHub hosts the bytes; git
never sees them. This replaced committing them to the PR branch, which welded a few hundred kilobytes
into `main` per merged PR — 8.1 MB of it was deleted in one go. The URLs carry neither a branch name
nor a SHA, so auto-delete-on-merge can't break them.

**Those prereleases are permanent — don't tidy them away after merging.** They host images the merged
PR body still links, so deleting one breaks them the same silent way deleting the branch used to. Keep
the bytes out of git *and* the release in place; that's the whole trade. `gh release delete` is for a
PR closed without merging, or captures superseded on the same PR. There is no attachment API and
`data:` URIs are stripped by GitHub's sanitiser — `pr-description` documents both dead ends so they
don't get re-derived.

Two legacy exceptions: PRs #16–#18 and #20 link SHA-pinned `raw.githubusercontent` URLs into `main`'s
history, and `assets/pr-14` is a branch that exists solely to host PR #14's images. Neither has a PR
of its own, so nothing deletes them automatically — leave both alone.

**Personal commands shadow this repo's, not the other way round.** Precedence is enterprise >
personal (`~/.claude/`) > project (`.claude/`) — project is *lowest*, which is the opposite of the
intuition ([slash-commands docs](https://code.claude.com/docs/en/slash-commands)). So a
`~/.claude/commands/<name>.md` makes the tracked copy dead code: editing the one in this repo changes
nothing about what runs, and `skillOverrides` is no escape hatch, since hiding a name errors instead
of falling through. This bit twice in one session — a rewritten `/prune-branches` and a rewritten
`/pr-description` both sat inert in the repo while the personal copies ran.

The fix is a **`personal-` prefix in the filename**: `~/.claude/commands/personal-prune-branches.md`
gives `/personal-prune-branches`, leaving the bare name to this repo. If you add a command here, check
`~/.claude/commands/` for a collision on the unprefixed name.

A subdirectory (`~/.claude/commands/personal/prune-branches.md`) is *not* the answer, despite looking
like one: it does produce `personal:prune-branches` in the skill listing the model is shown, but that
name is not typeable in the `/` menu — `/personal:` matches nothing — so a human can't reach it. The
naming table in the docs covers neither case, and the two surfaces disagree, so check the `/` menu and
not just the listing before believing a namespaced command works. A colon can't go in the filename
either; NTFS reserves it.

`/prune-branches` reports deletion candidates for local *and* remote branches, including which PR
bodies would break, and never deletes anything itself.

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
identifiers (the app's own hostname, the invite `From:` address) are fine as `vars`; anything personal
or credential-like goes through `wrangler secret put`. Current secrets: `BETTER_AUTH_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`. (`INITIAL_ADMIN_EMAIL` is gone — ADR 0012.)

**There is no build-time env var any more.** The frontend needs no publishable key — auth is
same-origin, so `src/lib/authClient.js` takes no `baseURL`. That removed `.env.production` entirely,
along with the old trap of having to set the same key in two places.

**`BETTER_AUTH_SECRET` is a data-encryption key, not just a signing key.** Better Auth uses it for
symmetric encryption as well as cookie signing, so rotating it casually can orphan encrypted values;
rotate via `BETTER_AUTH_SECRETS` (plural, versioned) if it ever needs to change.

## Onboarding

A six-step wizard (`src/components/Onboarding.jsx`) greets an invited person once, between their
first Google sign-in and the list. App gates on `users.onboarded_at IS NULL` (via `/api/whoami`);
finishing PATCHes `/api/me` with `{ name, color, onboarded: true }` — `onboarded_at` is one-way
(`COALESCE`) and `PATCH /api/me` can never touch `role` or `status`. Avatar `color` is a palette
key validated against `AVATAR_COLORS` in `worker/db.js`, with the class strings (Tailwind-literal,
for JIT) in `src/lib/constants.js`. The step-four check-off is a local demo on purpose — a tutorial
must not tell the household a real task happened. Under `dev:no-auth` the synthetic user counts as
already onboarded; add `--var DEV_ONBOARDING:true` to reach the wizard locally.

## Quick-add suggestions

`QuickAdd` is a combobox over `CHORE_CATALOG` in `src/lib/choreCatalog.js` — a couple of hundred
curated Polish chores with a category and a default rhythm, matched in the browser by
`src/lib/choreSearch.js` (ADR 0014). There is no endpoint and no index: the catalog is identical for
every household, so it is build-time data. `QuickAdd` `import()`s the search module on first focus,
which keeps the catalog in its own chunk rather than on the path to first paint — don't turn that
back into a static import.

Three properties are load-bearing. **Catalog entries never carry `startsOn`**; the anchor is stamped
from `today` when a suggestion is picked, because a canned date would be wrong for everyone and an
interval without an anchor means nothing (ADR 0010). **Free text still wins** — Enter with no
suggestion highlighted behaves exactly as it did before the catalog existed. **Polish morphology is
handled in the data, not the matcher**: `fold()` strips diacritics (including `ł`, which NFD leaves
alone) and matching is token-prefix AND, so inflected forms go in each entry's `keywords`. There is
no stemmer and shouldn't be one. `choreCatalog.test.js` enforces the data invariants; a typo there
fails CI rather than shipping as a chore that never comes due.

This is *alongside* direction 3b, not instead of it — `docs/runbooks/quickadd-ai-parse.md` stays
live for free-form sentences the catalog can't know.

## Admin portal and Panel domu

`/admin` is a separate page (not a panel), gated on `role === 'admin'` client-side and enforced
server-side by `requireAdmin` regardless. It can invite users and block/unblock them. Its copy uses
the household vocabulary: **Domownicy**, roles **Domownik** / **Gospodarz**, actions **Odetnij
dostęp** / **Przywróć dostęp**.

`/panel` (**Panel domu**, `HomePanel.jsx`) is the wider household-management page: Dom (name, week
start, default rhythm, reminder toggles — settings in the single-row `home_settings` table), Domownicy
(the *same* `AdminPortal` component rendered with `embedded`, which also unlocks the role-change
action), Kategorie (the editable `categories` table; deleting one re-files its tasks into `home`),
and Dane domu (export, empty archive, trim history, delete home). See ADR 0013. Household settings
and the category list reach components through `useHomeSettings()` / `useCategories()` — shared
module caches with built-in fallbacks, invalidated by the panel after a write. Role changes must go
through `db.setUserRole` (last-gospodarz guard) followed by `syncAuthUserRole`, per the two-column
rule above.

Inviting is purely a D1 write — Better Auth has no notion of the person until their first Google
sign-in. The Resend email is a courtesy and is allowed to fail without failing the invite, so the UI
reports which of the two happened. Blocking writes `status = 'revoked'` (which is what actually locks
them out, immediately, since cookie caching is off) and additionally calls the `admin` plugin's
`banUser` to revoke existing session rows.

**Deliberately absent, per ADR 0009 — don't add them back as "missing features":** no MFA control and
no password reset. Google is the only sign-in method, so both belong to the Google account. Better Auth
has no admin 2FA API at all, and app-owned TOTP wouldn't help anyway: its 2FA challenge only fires on
`/sign-in/email|username|phone-number`, so social sign-in is never challenged. The corollary is that
**adding Google-alongside-passkeys or any second provider re-opens that hole** — think before
extending `socialProviders`.

The app therefore cannot verify a household member actually has Google 2FA enabled; Google's ID token
carries no such claim. That's the same position ADR 0003 accepted with Access + Google SSO.

## Cloudflare Access retirement

Access (Google SSO) → Clerk → Better Auth. Access intercepts at the edge before app code runs, so it
and an in-app login screen can't both gate one hostname; the Access application is kept
configured-but-bypassed for a short bake period as an emergency fallback. Because Better Auth runs *in*
the app rather than at the edge, it could be verified in production behind a still-active Access gate
before the Bypass policy went on.

`users.clerk_user_id` is gone (migration 0007). The one thing still outstanding is deleting the
Cloudflare Access application itself, which is dashboard work and nothing in this repo depends on.
The cutover runbook that walked through the bake period is deleted too — it described a sequence
that has already happened, and a runbook for a completed one-off is a trap: it reads like
instructions.

## Local development

Copy `.dev.vars.example` to `.dev.vars` (gitignored) and fill it in. There's no separate provider
"development instance" to create: Google accepts `http://localhost:8787/api/auth/callback/google` as a
redirect URI, so local work uses the same OAuth client as production. `npm run dev:worker` then signs
in through the real Google flow.

`npm run db:seed:local` loads `scripts/seed-local.sql` — twelve tasks covering all five rhythms, all
three stops, plus completion history for the week card. It deliberately writes no `users` row, since
that is what `npm run admin:grant` is for.

**`npm run dev:no-auth` skips sign-in entirely** (ADR 0011), for working on the UI without Google
credentials. It passes `--var DEV_NO_AUTH:true`, and `devBypassUser` in `worker/auth.js` synthesises a
local admin. Two things about it are load-bearing:

- **It also requires a loopback hostname.** That, not the flag, is what makes it safe: `DEV_NO_AUTH`
  leaking into deployed config still couldn't activate it, because production has exactly one public
  hostname (ADR 0004). There are guard tests in `worker/auth.test.js` — treat a failure there as a
  security regression, not a broken feature.
- **The whole bypass is server-side.** The fake session is served from the Worker's `/api/auth/*`
  carve-out, so no bypass code exists in the browser bundle and a production build has no way to skip
  the login screen. Don't "simplify" this into a `VITE_*` flag.

What it therefore *cannot* exercise, and what still needs a real Google sign-in: the login screen, the
invite gate, and role mirroring into Better Auth's tables. It also leaves
`users` empty on purpose, so you won't see yourself in the admin portal's list.

That also removes a trap the Clerk setup had: Clerk enabled *paid* features in development instances
only, so MFA and user-banning worked locally and were silently unentitled in production. Nothing here
behaves differently between local and production except the hostname.

The invite → `pending` → `active` transition needs no local tunnel or forwarding: it's Better Auth's
`user.create.after` database hook, running in-process. Invite an address from `/admin`, sign in as it
through the real Google flow, and watch the `users` row flip.
