# Anchor recurrence to a start date instead of the last completion

## Status

Accepted

## Context

Until now `src/lib/taskLogic.js` derived everything from one number: `getIntervalDays(interval)`,
counted forward from `lastDone`. `weekly` meant 7, `monthly` meant 30, and a task never completed had
no schedule at all — `computeStatus` short-circuited to `overdue` for anything with `lastDone ===
null`. That model has three failures that show up immediately in a household with real recurring
chores:

- **A late completion silently re-bases the whole future.** A bill due on the 1st, paid on the 4th,
  becomes due on the 4th of every following month. Nothing in the UI said this would happen, and
  nothing let the user say "no, keep the 1st".
- **"Co miesiąc" was not monthly.** Thirty days drifts against the calendar by roughly five days a
  year, so a rent reminder walks backwards through the month. There was no way to express "the 1st",
  "the last day", or "the first Saturday".
- **A brand-new task was born overdue.** With no anchor there was no other answer available, so
  adding "wymienić filtr co 3 miesiące" put a red item on the list the moment it was created.

The redesign in the `Home Dashboard.dc.html` design project (directions 2a, 2b/3a) treats this as the
core of the rebuild rather than a detail: its rhythm editor never shows a rhythm without also showing
*"od kiedy liczymy?"*, on the grounds that "every 3 days" has nothing to hang off without it and the
user is left guessing. Adopting the design's screens without its data model would have produced an
editor whose anchor field did nothing.

Two smaller decisions rode along with the same change and are recorded here rather than separately,
since neither stands alone:

- The design specifies `lucide-react` at stroke 1.8 as the icon set and *no emoji anywhere*. The
  existing UI used emoji for actions (✅ 📌 🗄️ 🗑️) and for the theme toggle, which render
  differently per platform and carry no consistent weight.
- The design's "Ten tydzień: 11 rzeczy ogarniętych — Anna 6 · Kuba 5" card cannot be computed from
  `/api/tasks`, because `tasks.last_done` only remembers the newest completion.

## Decision

**Every non-manual interval carries an anchor**, `startsOn` (an ISO date), and the anchor defines a
grid of deadlines. The first deadline is `startsOn`; subsequent ones step from it; and once a task has
been completed, its next deadline is the first grid point strictly after `lastDone`. The interval
model becomes:

> **Amended by [0015](0015-express-yearly-rhythms-as-a-monthly-multiple.md).** "The first deadline is
> `startsOn`" is no longer true: the anchor means *not before this*, and the first deadline is the first
> grid point **on or after** it. Returning the anchor verbatim fired one occurrence no rule had asked
> for — "co miesiąc, pierwszego" anchored on the 27th previewed `27.07 → 01.09 → 01.10`. Everything else
> in this record stands; 0015 also widened the monthly arm with `every` / `unit`, so the model below is
> the pre-0008 shape.

```js
{ type: 'daily',      startsOn }
{ type: 'everyNDays', n, startsOn }
{ type: 'weekly',     weekdays: [1..7], startsOn }   // 1 = Monday
{ type: 'monthly',    day: 1..28 | 'first' | 'last' | { nth, weekday }, startsOn }
{ type: 'manual' }
```

`src/lib/taskLogic.js` is replaced by `src/lib/recurrence.js`, which keeps the property that made the
old module testable — every function takes `today` as an explicit argument and none reads the system
clock. The four derived statuses survive unchanged in number; `inactive` is renamed `later` to match
the UI's "Na spokojnie".

Because changing a rhythm now moves a deadline visibly, `RhythmEditor` asks which base to count from
(the last completion, or today) whenever the interval of an already-completed task changes, and
previews the next three deadlines before anything is saved.

Migration `0004_add_interval_anchor_and_variants.sql` adds `interval_starts_on`,
`interval_weekdays` and `interval_day` to `tasks` and backfills
`COALESCE(last_done, substr(created_at, 1, 10))` — which reproduces each existing task's current
cadence exactly, since anchoring on the last completion *is* the old behaviour.

Alongside: `lucide-react` is added as the icon set and all emoji are removed from the UI; and
`GET /api/stats/week` plus `DELETE /api/tasks/:id/complete` are added, reading and writing the
`completions` table that until now was written but never read.

## Consequences

**"Every 3 days" now means something specific**, and the same words mean the same thing whether or
not the task was done on time. A missed deadline no longer moves the schedule; catching up is
catching up, not rescheduling. Monthly genuinely means monthly. A new task can be scheduled to start
in the future instead of being born overdue.

**`groupTasks` and `filterForView` no longer filter out archived tasks themselves** — the caller's
view filter decides, which is what lets the Schowek view render at all. Anything calling `groupTasks`
directly must pass an already-filtered list.

**Migrations and code must ship in the documented order.** 0004 is purely additive and the live
Worker reads none of the three new columns, so the ordering ADR 0007 imposes (migrations first, then
the Worker) holds without a two-step deploy. But the backfill only runs once: a task created between
the migration and the deploy would have a null anchor, and `computeStatus` treats an anchorless
recurring task as `overdue` rather than hiding it. That is deliberate — it is visible and
correctable, where the alternative is a task that never surfaces.

**`priority` is now dead in the UI but alive in the schema.** The design removed it in favour of
`pinned` ("Trzymaj na wierzchu"). The column stays, `NOT NULL DEFAULT 'medium'`, so nothing writes it
and nothing reads it; dropping it needs the create/copy/drop/rename dance D1 requires and is left for
a follow-up alongside the already-pending `users.clerk_user_id` removal.

**Undo now mutates history.** `DELETE /api/tasks/:id/complete` removes the newest `completions` row
and recomputes `tasks.last_done*` from what remains, rather than blanking the cache. The alternative —
leaving the row and only correcting the cache — would have made "Anna did this 6 times this week"
count taps that were taken back seconds later. The window is deliberately short (8 s, `UNDO_WINDOW_MS`)
so this is a correction, not an edit facility.

**One more dependency to keep current.** `lucide-react` is tree-shaken (the production bundle grew
about 10 kB gzipped for roughly a dozen icons), but it is a dependency this app did not have, and
icon-set churn between majors is a real maintenance cost. It is pinned by caret like the other
frontend dependencies rather than exactly, since unlike `better-auth` it has no coupled database
schema.

**Direction 3b — the AI quick-add — is deliberately not built.** The field is present and degrades to
what the design specifies as its own fallback: type a name, press Enter, confirm the rhythm in the
sheet. Wiring it to a model needs a Worker-side key, a request cap, and a decision about per-request
cost, none of which exist yet; `docs/runbooks/quickadd-ai-parse.md` records what turning it on
involves.
