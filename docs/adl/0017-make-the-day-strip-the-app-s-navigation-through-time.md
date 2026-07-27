# Make the day strip the app's navigation through time

## Status

Accepted

## Context

The day strip on the hero card has always known more than it could say. It reads
`dueDate` for every task and draws twelve bars, so it knew that next Thursday holds four things — and
that knowledge went nowhere, because the bars were inert `<div>`s. Its own comment said so: *"Inert
unless someone wants to act on a day — a button that does nothing is worse than a bar that never
claimed to be one."* `onSelectDay` had been threaded from `HeroCard` since the strip was written, and
nothing ever passed it.

Meanwhile there was no way to look at a specific day at all, and no way to look past the twelve days
the strip happened to cover. The four views answer *"is this due now, soon, ever, or put away"*; none
of them answers *"what falls on the 12th"*. The design kit has arrows either side of the strip
(`Nudge`) and a range caption, but both are decoration there — the arrows carry no handler.

## Decision

**A bar filters the list to the day it counted.** `filterByDay` uses the same `dueDate` test `dayLoad`
uses, so the two agree on what belongs to a date — though the *list* built on top of them has to honour
that too, and initially did not: it re-applied the "hide today's completions" filter and so emptied
itself on a closed day while the bar still read 2. See ADR 0018. The filter composes with the
existing category filter and view rather than replacing them, which is what makes it cheap: it behaves
like the category chips, including a chip of its own and a "Pokaż wszystko" to clear.

The consequence worth stating: a thing ticked off today is filed under its *next* deadline, not under
today, because that is what the bar counted. So today's bar empties as the day is cleared, and the
drill-down for today shows what is still to do. The bar counts work, not history.

**The arrows page the window by a week**, via an `offset` in days on `dayLoad`. `isToday` and `overdue`
stay measured against the real today rather than against the window, so a bar means the same thing
however far the strip has been scrolled. A range caption appears with the arrows — two taps in, the
bars alone no longer say which week is on screen — and needed three-letter month abbreviations, which
is why `formatDayRange` exists alongside `formatDate`.

**Paging and selection are separate state.** Scrolling forward to look around does not clear the day
being read, and picking a day does not move the window.

**The reward and Zrobione dziś are suppressed while a day is selected.** Both summarise today as a
whole; a day filter asks about one date. One click clears it and they come back.

## Consequences

The strip is now the only control in the app that can reach an arbitrary date, which makes it
load-bearing rather than decorative. Two things follow for anyone changing it:

- The bars are `<button>`s only when `onSelectDay` is given, and the accessible name has to carry the
  whole date and count — the visible labels are three characters of weekday and a bare number, which
  is not a date. `aria-pressed` carries the selection.
- The way back to today sits *beside* the range, not in place of the forward arrow. Putting it there
  was the first thing built and it made a second week forward unreachable: the way back may cost an
  extra control, the way on may not. There is a test for exactly that.

Overdue work sits on the date it was missed, which for a long-neglected thing can be months back and
therefore off the strip until you page to it. That is consistent with the bars — they have always
counted deadlines, not backlog — and the arrears are on the list anyway, under "Zaległe", where they
are meant to be found.

Nothing here touches the API, the schema or the payload: every date the strip can reach is derived from
the same `/api/tasks` response the list already had.
