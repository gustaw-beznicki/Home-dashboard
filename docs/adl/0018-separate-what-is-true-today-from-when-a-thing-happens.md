# Separate "what is true today" from "when does this happen"

## Status

Accepted

## Context

`src/lib/recurrence.js` answers two different kinds of question, and mixing them up has now produced
three user-visible bugs in a row. This record exists because the third one arrived after the second was
fixed, which is the point at which a mistake stops being a bug and starts being a missing rule.

The two kinds:

- **What is true of this thing today.** `computeStatus` → `done | due | overdue | later`. It is a
  statement about the present, and `done` in particular is true only for the rest of the calendar day.
- **When does this thing happen.** `dueDate`, and the grid behind it: the anchor says where the grid
  starts, `lastDone` says where on it this task already is. These are dates, and they do not care what
  day it is.

Every one of the bugs came from reaching for the first where the second was needed:

1. **The Najbliższy tydzień view was empty** while the hero's day strip drew bars for tomorrow. It
   filtered on `status === 'later'`, and anything ticked off today reads `done` until midnight — so a
   daily chore done this morning and due again tomorrow was not in the coming week at all.
2. **The same view's order was wrong** once the filter was fixed: `sortByUrgency` ranks by status
   before proximity, so with mixed statuses "za tydzień" sat above "za 3 dni". And grouping by status
   filed a thing ticked off this morning under **Na dziś**, the one stop it is not in.
3. **The rhythm editor's deadline preview disagreed with the card about the same task.** It called
   `upcomingOccurrences(interval, today)`, which walks the interval's grid from today and knows nothing
   about the task. On a monthly bill anchored in January and last paid on 1 June, the preview said
   "1 sierpnia" while the card next to it said "26 dni po terminie".

4. **A day drill-down showed nothing** while the bar that opened it said "2". `filterByDay` was right,
   but the list built around it still dropped anything whose status was `done`, so on a closed day it
   removed exactly the things the bar had counted — every completion is counted under its *next*
   deadline.

Each was fixed locally, and each fix looked like a one-line correction, which is exactly why the next
one landed. The fourth arrived *after this record was written*, from the paragraph below that claimed
the bar and its drill-down "cannot disagree": that was true of the two functions and false of the list
built on top of them. Getting the helpers right is not the same as getting every reader of them right.

## Decision

**Anything about scheduling is keyed off dates, never off the derived status.** In practice that is
four functions, and the reason they exist rather than a `status` check inline:

| Question | Function | Not |
|---|---|---|
| What falls due in the coming week? | `filterForView('upcoming')`, on `0 < until <= 7` | `status === 'later'` |
| In what order? | `sortByNextDue` | `sortByUrgency` |
| What falls on this date? | `filterByDay`, on `dueDate` | any status test |
| What are this task's next deadlines? | `upcomingForTask(interval, lastDone, today)` | `upcomingOccurrences(interval, today)` |

`upcomingOccurrences` stays, because "what does this *rule* produce" is a real question — it is what a
brand-new task with no completion shows. It is simply not the question a card or a list is asking.

**Presentation follows the same split.** A view that is about dates renders as dates: Najbliższy
tydzień is one flat section (three urgency stops would all say the same thing) and `TaskCard` takes a
`renderAs` override so a thing ticked off this morning appears there as future work with its date,
rather than struck through with "cofnij". Conversely the things that summarise *today* — the reward,
`DoneToday`, the progress bar — are suppressed in views that are not about today.

**Two ways to say "count from the last completion" coexist on purpose.** `rebaseInterval` answers a
question the app asks *you* — "you changed the rhythm on a task with history; count from the completion
or start over?" — and its `lastDone` branch is a no-op that leaves the anchor alone. The
"od ostatniej daty" chip is something *you* say to the app: move the anchor onto the completion date.
They read similarly and are not the same thing: the first preserves an anchor, the second overwrites
one. Deleting either would lose a distinct instruction.

## Consequences

The status is now a presentation concern plus the grouping on the main list, and nothing else. A new
feature that wants to know "when" has four functions to reach for and should add a fifth rather than
inspect `computeStatus`.

**The bars count work, not history**, and that follows from this rule rather than being a separate
choice: `filterByDay` uses `dueDate`, so a thing ticked off today is filed under its *next* deadline.
Today's bar therefore empties as the day is cleared, and the drill-down for today shows what is still
to do. Anyone who "fixes" that by special-casing today's completions will reintroduce bug 1 in a new
place.

**Every list built on those functions has to honour the rule too**, which is where bug 4 came from. A
date-keyed list must not re-apply a status filter on top: the day drill-down is one flat section that
keeps completions, rendered at each card's real status only when the selected day *is* today — that is
the one day you can act on, so it keeps its tick buttons — and as the quiet tier otherwise. The
guard is `e2e/day-complete.spec.mjs`, at the level the bug actually lived: the library functions were
correct throughout, so no unit test of them could have caught it, and `src/lib/recurrence.test.js` now
pins the count-equals-list contract they provide.

**The editor's preview is now anchored to the same completion the card is**, so the two cannot
disagree. The cost is that the preview changes when the last-completion field changes, which is why
that field sits above the anchor in the editor rather than further down the sheet: rhythm, then when it
was last done, then what to count from — each answer narrowing the next.

**This is a rule about reading, not about storage.** No schema change, no API change, and the anchor
semantics of ADR 0010 and ADR 0015 are untouched — including that the anchor means "not before this",
so a completion earlier than the anchor is still ignored, and "od ostatniej daty" is how you say you
meant otherwise.
