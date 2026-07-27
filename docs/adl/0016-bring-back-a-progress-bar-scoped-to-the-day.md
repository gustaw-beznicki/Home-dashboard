# Bring back a progress bar, scoped to the day, and reward closing it

## Status

Accepted

## Context

The `Ogarniamy` UI kit in the claude.ai/design project (`ui_kits/ogarniamy/index.html`) gained two
things the app did not have: a progress bar on the hero card, and a card that appears when everything
that fell due today has been ticked off.

The bar needs a decision because it reverses one. `HeroCard` still carries the comment that records
it — *"Replaces the old percentage bar. For ten-to-forty tasks and two people a percentage carried no
information"* — and the design system repeats the rule in `HeroSummary.prompt.md`: the headline is a
sentence about the day, not a percentage. Adding a percentage back without saying why would read as a
session that had not read the file it was editing.

The reward card needs one because the kit's version of the dashboard also restructures the list: it
moves everything ticked off into a separate, collapsible **Zrobione dziś** section, with a comment
explaining that the day-complete state used to eat that section and make undo impossible. The app does
something different and also deliberate — a completed thing keeps its place in the group it was ticked
off in for `UNDO_WINDOW_MS`, greyed out, with "cofnij" (`useUndoWindow` in `Dashboard.jsx`, recorded in
`CLAUDE.md`), because the list must not reshuffle under the thumb that just tapped it. Two designs,
each with a written rationale, and they conflict.

## Decision

**The bar measures the day, not the backlog.** `dayProgress` in `src/lib/recurrence.js` counts what
fell due today or earlier, and its denominator keeps the things already ticked off. That is what makes
it different from the percentage that was removed: the old one divided by the whole list, so it barely
moved and answered a question nobody asked. This one starts the day at `0 z 6` and reaches `6 z 6`, so
it is a report on a finite piece of work. It always carries the count next to the percentage, because
"60%" alone does not say how much is left. A day with nothing due reads 100%, not 0% — an empty day is
a success, not a zero.

A "na spokojnie" thing ticked off early stays out of the count, keyed off the sticky map that already
remembers which stop each completion came from. Without that, the tap that gets ahead of the week
would grow the denominator and send the percentage backwards.

**The reward stands above the completions, and the sticky groups stay.** `DayComplete` renders above
the list, never in its place, which is the rule the design system states and the reason the kit
restructured the list at all. The app satisfies that rule already: the things just ticked off are
sitting in their own groups with "cofnij" on them. So the sticky-group behaviour stays and the
separate **Zrobione dziś** section does not get built — it would trade a recorded decision for
nothing, since the invariant it protects is met either way.

`dayClosed` in `src/lib/recurrence.js` is the guard, and it tests for *a visible completion*, not for
a non-empty list. Those are not the same thing and the difference is a real state: reopen the app after
the undo window has closed and the list still holds everything in "Na spokojnie", so a non-empty test
would show a reward for work no longer on screen and offer nothing to take back.

**The two animations are the system's whole motion budget for decoration**, and both hang off a real
event rather than off arriving on a screen: the rollback nudge, and this. Neither loops. The falling
leaves are decoration on top of decoration, so `prefers-reduced-motion` removes them outright rather
than shortening them — `[data-leaf]` in `src/index.css` — and the medallion and the sentence carry the
message without them.

## Consequences

`recurrence.js` gains two more functions that take `today` as an argument and never read the clock,
which keeps them unit-testable; the day-complete rule is therefore a unit test rather than a comment.

The reward's copy could not be the kit's "Dzień ogarnięty." The hero sentence two lines above already
says "Na dziś nic więcej. Dom ogarnięty." and the pair stuttered — visible only by looking at a
rendered screen, not from either file alone. It says "Wszystko z głowy." instead, which is the design
project's own phrase for the same state.

`src/index.css` now holds four keyframes and an `--ease-pop` that exist for one component. That is the
cost of the reward being a one-off; if a second celebration ever appears, they are already shared.

Two follow-on constraints for anyone editing this later: the bar's colours are measured against the
hero, which is dark in **both** themes, so they are literals rather than theme roles that flip; and
`playKey` is what makes the animation play once, so a render that changes it for any reason other than
"a tick was taken back and redone" will replay the celebration.
