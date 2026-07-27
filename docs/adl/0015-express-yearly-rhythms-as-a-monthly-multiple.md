# Express yearly rhythms as a monthly multiple, and snap the anchor to the grid

## Status

Accepted

## Context

Real household chores run on cadences the rhythm model could not express. A car's technical
inspection is annual, or every two years while the car is new; boiler and chimney servicing are
annual; tyres are swapped twice a year; an OC policy renews yearly. The model had `daily`,
`everyNDays`, `weekly`, `monthly` and `manual`, so the closest available answer for all of these was
"co miesiąc" — and the bundled chore catalog (ADR 0014) actually shipped that answer for nine of
them, suggesting a monthly car inspection to anyone who picked it.

`everyNDays` was not a workaround. "Co 365 dni" drifts against the calendar and "co 730 dni" is
meaningless to read on a card; the whole point of ADR 0010's anchor grid is that "co miesiąc" means a
calendar month rather than 30 days, and the same must hold for a year.

A second, older defect surfaced while designing this. `nextOccurrenceAfter` returned `startsOn`
verbatim as the first deadline of a never-completed task, without checking that the anchor lay on the
grid its own rule described. So "co miesiąc, pierwszego dnia" anchored on 27 July previewed
`27.07 → 01.09 → 01.10`: one deadline off-grid, then the rule taking effect. The same applied to
weekly — an anchor on Tuesday with only Monday selected fired on the Tuesday. At month scale this
looked like a cosmetic oddity; at year scale it would mean a two-year rhythm firing twice in the
first fortnight.

## Decision

**Extend `monthly` with `every` and `unit` rather than adding a `yearly` type.** An interval is now
`{ type: 'monthly', every, unit: 'month' | 'year', day, startsOn }`. Migration 0008 adds
`interval_every INTEGER` and `interval_unit TEXT`, both additive, and the reader treats absent values
as `every: 1, unit: 'month'` so every pre-existing row keeps its meaning.

The alternative — a real `yearly` type — was rejected on cost, not taste: `interval_type` carries a
`CHECK` constraint, D1 cannot `ALTER` one, and widening it means the create-new-table / copy / drop /
rename rebuild. That buys a slightly tidier discriminant and nothing else. The same reasoning is
already recorded in ADR 0013 for the category CHECK.

**A year is stored as a multiple of months** (`every * 12`) at read time, so both units share one
code path in `nextOccurrenceAfter`. This is what makes 29 February behave without special-casing: the
existing day-rule clamp to the length of the target month puts a leap-day anchor on the 28th in
common years and back on the 29th when the target year is itself a leap year.

**With `unit: 'year'` there is no day rule at all.** The month *and* the day come from the anchor, so
the editor hides the day-mode panel rather than offering a choice that cannot mean anything —
"pierwszego dnia" would be identical to `day: 1`, and "ostatniego dnia" means something different at
year scale than at month scale. `intervalColumns` clears `interval_day` for yearly rows so a rule
left over from a spell as a monthly rhythm cannot contradict the anchor.

**The anchor now means "not before this", not "this is the first deadline".** The first deadline is
the first grid point on or after `startsOn`. Daily and `everyNDays` are unaffected — the anchor *is*
grid point zero — but weekly snaps forward to a selected weekday and monthly snaps forward to a date
the day rule actually produces.

**Months and years are separate chips in the editor** even though they are one stored type. Burying
"co 2 lata" inside a monthly panel would make it unfindable, which is the entire complaint that
started this.

## Consequences

Nine catalog entries move from monthly to yearly and three to every-six-months, so the suggestions
stop being actively wrong. The catalog's invariant test now validates `unit` and `every` whenever
they are present and forbids a `day` rule on a yearly entry, so a typo fails CI rather than shipping
as a chore that never comes due. `unit`/`every` stay optional in catalog data: the reader normalises
them, and spelling out the default on 85 monthly entries would be noise.

`intervalKey` normalises the two new fields, which is load-bearing rather than tidy. Without it, an
interval read back from a pre-0008 row would not compare equal to the same rhythm rebuilt by the
editor, and `TaskSheet` would ask "od czego liczyć?" about a rhythm nobody had touched.

The snapping change alters existing behaviour, not just new tasks: any task with an off-grid anchor
and no completion moves its first deadline forward. That is the point — it moves from a date no rule
asked for to the date the rule describes — but it is a visible change to live data rather than a
purely additive one. Tasks with a `lastDone` are untouched, since they were already counted from the
grid.

The cadence chips cover 1/2/3/6 months and 1/2/3/5 years. A value outside those lists stays selected
and is described in words underneath rather than snapping to the nearest chip, so a rhythm entered
another way (an import, a direct D1 edit) is not silently rewritten by opening the editor.

Still open, deliberately: the `{ nth, weekday }` monthly rule remains hardcoded to the first Saturday
in the UI, even though `describeInterval` now reads whatever it is given. Adding the two pickers is a
separate, purely additive change.
