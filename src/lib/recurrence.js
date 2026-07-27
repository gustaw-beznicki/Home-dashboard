// Pure rhythm and status logic. Every function takes `today` explicitly and
// never reads the system clock — that property is what makes it testable, so
// keep it. Supersedes the old taskLogic.js, which had no anchor date.
//
// Interval model:
//   { type: 'daily',       startsOn }
//   { type: 'everyNDays',  n, startsOn }
//   { type: 'weekly',      weekdays: [1..7], startsOn }   // 1 = Monday
//   { type: 'monthly',     every, unit: 'month' | 'year', day, startsOn }
//   { type: 'manual' }
//
// The monthly `day` rule is `1..28 | 'first' | 'last' | { nth: 1..4, weekday: 1..7 }`
// and applies to `unit: 'month'` only. With `unit: 'year'` the month *and* the
// day both come from the anchor — "przegląd 12 marca co 2 lata" needs no day
// rule, and "ostatniego dnia" would mean something different at year scale — so
// the editor hides that panel entirely rather than offering a meaningless choice.
// `every` defaults to 1, which is what every pre-0008 row reads back as.
//
// A year is modelled as twelve months rather than as its own arm, so both units
// share one code path. That is also what makes 29 February behave: the day rule
// clamps to the length of the target month, so a leap-day anchor lands on the
// 28th in common years instead of skipping to March.
//
// `startsOn` is the anchor: an ISO date that fixes the grid of deadlines. It
// means "not before this", **not** "the first deadline" — the first deadline is
// the first grid point on or after it. Anchoring "co miesiąc, pierwszego" on the
// 27th used to fire once on the 27th and only then settle onto the 1st, which
// read as a bug every time. Without an anchor "every 3 days" has nothing to hang
// off at all, which is why it is never hidden in the editor.

import { countWith, FORMS, ORDINALS_ACCUSATIVE, WEEKDAYS_ACCUSATIVE } from './plural.js'

const DAY = 86400000

export function toMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function toISODate(date) {
  const d = toMidnight(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function diffInDays(later, earlier) {
  return Math.round((toMidnight(later) - toMidnight(earlier)) / DAY)
}

export function addDays(date, n) {
  const d = toMidnight(date)
  d.setDate(d.getDate() + n)
  return d
}

// getDay() is 0 = Sunday. Our model is ISO: 1 = Monday … 7 = Sunday.
export function isoWeekday(date) {
  return date.getDay() === 0 ? 7 : date.getDay()
}

function lastDayOfMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function monthlyDateFor(year, month, rule) {
  if (rule === 'first') return new Date(year, month, 1)
  if (rule === 'last') return new Date(year, month, lastDayOfMonth(year, month))
  if (typeof rule === 'number') {
    return new Date(year, month, Math.min(rule, lastDayOfMonth(year, month)))
  }
  // { nth, weekday } — e.g. the first Saturday of the month.
  const first = new Date(year, month, 1)
  const shift = (rule.weekday - isoWeekday(first) + 7) % 7
  const day = 1 + shift + (rule.nth - 1) * 7
  return day > lastDayOfMonth(year, month) ? null : new Date(year, month, day)
}

function anchorOf(interval) {
  return interval.startsOn ? parseISODate(interval.startsOn) : null
}

// A year is `every * 12` months and takes its day from the anchor; a month is
// `every` months and takes it from the rule. One shape, so `nextOccurrenceAfter`
// has a single monthly arm rather than two that drift apart.
function monthlyGrid(interval, start) {
  const every = Math.max(1, interval.every ?? 1)
  const yearly = interval.unit === 'year'
  return {
    stepMonths: yearly ? every * 12 : every,
    rule: yearly ? start.getDate() : (interval.day ?? start.getDate()),
  }
}

/**
 * The first monthly grid point at or after `boundary` (`inclusive`) or strictly
 * after it. Walks forward from an estimated index rather than computing one,
 * because an nth-weekday rule can be absent from a given month — "the fifth
 * Saturday" simply doesn't exist in most of them.
 */
function monthlyPointFrom(interval, start, boundary, inclusive) {
  const { stepMonths, rule } = monthlyGrid(interval, start)
  const monthsAhead =
    (boundary.getFullYear() - start.getFullYear()) * 12 + (boundary.getMonth() - start.getMonth())
  const first = Math.max(0, Math.floor(monthsAhead / stepMonths))

  for (let k = first; k <= first + 24; k++) {
    const probe = new Date(start.getFullYear(), start.getMonth() + k * stepMonths, 1)
    const date = monthlyDateFor(probe.getFullYear(), probe.getMonth(), rule)
    if (!date || date < start) continue
    if (inclusive ? date >= boundary : date > boundary) return date
  }
  return null
}

/**
 * The first deadline for an interval whose task has never been completed: the
 * first grid point on or after the anchor. For daily and everyNDays that is the
 * anchor itself — it *is* grid point zero — but weekly and monthly rules have
 * their own grid, and honouring the anchor literally would fire one deadline
 * that no rule in the editor asked for.
 */
function firstOnGrid(interval, start) {
  switch (interval.type) {
    case 'weekly': {
      const days = weekdaysOf(interval, start)
      for (let i = 0; i < 7; i++) {
        const candidate = addDays(start, i)
        if (days.includes(isoWeekday(candidate))) return candidate
      }
      return start
    }
    case 'monthly':
      return monthlyPointFrom(interval, start, start, true)
    default:
      return start
  }
}

// An empty chip list is reachable in the editor, and the grid has to mean
// something regardless; the anchor's own weekday is the least surprising answer.
function weekdaysOf(interval, start) {
  const days =
    interval.weekdays && interval.weekdays.length ? interval.weekdays : [isoWeekday(start)]
  return [...days].sort((a, b) => a - b)
}

/**
 * First grid point strictly after `after` — or `startsOn` itself when the task
 * has never been done. Null for manual rhythms and for anchorless intervals.
 */
export function nextOccurrenceAfter(interval, after) {
  if (interval.type === 'manual') return null
  const start = anchorOf(interval)
  if (!start) return null
  // Never completed, or completed before the grid even began: snap onto the
  // grid rather than returning the anchor verbatim.
  if (!after || toMidnight(after) < start) return firstOnGrid(interval, start)

  const from = toMidnight(after)

  switch (interval.type) {
    case 'daily':
      return addDays(from, 1)

    case 'everyNDays': {
      const n = Math.max(1, interval.n)
      const elapsed = diffInDays(from, start)
      const steps = Math.floor(elapsed / n) + 1
      return addDays(start, steps * n)
    }

    case 'weekly': {
      const days = weekdaysOf(interval, start)
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(from, i)
        if (days.includes(isoWeekday(candidate))) return candidate
      }
      return addDays(from, 7)
    }

    case 'monthly':
      return monthlyPointFrom(interval, start, from, false)

    default:
      return null
  }
}

/** The next `count` deadlines, for the preview strip in the rhythm editor. */
export function upcomingOccurrences(interval, from, count = 3) {
  const out = []
  // Start a day early so a deadline falling today still shows up first.
  let cursor = from ? addDays(from, -1) : null
  for (let i = 0; i < count; i++) {
    const next = nextOccurrenceAfter(interval, cursor)
    if (!next) break
    out.push(next)
    cursor = next
  }
  return out
}

/** The date a task is currently scheduled for. Null for manual rhythms. */
export function dueDate(task) {
  const { interval, lastDone } = task
  if (interval.type === 'manual') return null
  const done = lastDone ? parseISODate(lastDone) : null
  return nextOccurrenceAfter(interval, done)
}

/** 'done' | 'due' | 'overdue' | 'later' — always derived, never persisted. */
export function computeStatus(task, today) {
  const { interval, lastDone } = task

  if (interval.type === 'manual') {
    return lastDone === toISODate(today) ? 'done' : 'later'
  }
  if (lastDone === toISODate(today)) return 'done'

  const due = dueDate(task)
  // No anchor and never completed: treat as overdue rather than silently
  // parking it in "later" where nobody would ever see it again.
  if (!due) return 'overdue'

  const delta = diffInDays(due, today)
  if (delta < 0) return 'overdue'
  if (delta === 0) return 'due'
  return 'later'
}

/** Days until the deadline: >0 before, 0 today, <0 past. Null for manual. */
export function daysUntilDue(task, today) {
  const due = dueDate(task)
  return due ? diffInDays(due, today) : null
}

const STATUS_RANK = { overdue: 0, due: 1, later: 2, done: 3 }

export function sortByUrgency(tasks, today) {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

    const rank = STATUS_RANK[computeStatus(a, today)] - STATUS_RANK[computeStatus(b, today)]
    if (rank !== 0) return rank

    const aUntil = daysUntilDue(a, today)
    const bUntil = daysUntilDue(b, today)
    if (aUntil !== bUntil) {
      if (aUntil === null) return 1
      if (bUntil === null) return -1
      return aUntil - bUntil
    }

    return a.name.localeCompare(b.name, 'pl')
  })
}

/**
 * The dashboard's three stops. Takes an already view-filtered list — archiving
 * and the "Dziś / Najbliższy tydzień / …" rules belong to filterForView, not
 * here.
 *
 * `done` forms no group of its own: a task ticked off today stays where it was,
 * greyed out, so the list doesn't reshuffle under the thumb that just tapped
 * it. `stickyGroups` (id → group key, captured at tick time) is what preserves
 * that position; without it a completed task falls back to the "Na dziś" stop.
 */
export function groupTasks(tasks, today, stickyGroups) {
  const sorted = sortByUrgency(tasks, today)
  const groups = { overdue: [], due: [], later: [] }

  for (const task of sorted) {
    const status = computeStatus(task, today)
    if (status === 'done') {
      groups[stickyGroups?.get(task.id) ?? 'due'].push(task)
    } else {
      groups[status].push(task)
    }
  }

  return groups
}

/**
 * Sorted by when each thing next falls due, soonest first — for the Najbliższy
 * tydzień view, which is a chronology and not a queue.
 *
 * `sortByUrgency` is the wrong instrument there: it ranks by today's status
 * before proximity, and in that view the statuses are mixed (anything ticked off
 * today reads `done`), so "za tydzień" ended up above "za 3 dni". Pinning does
 * not reorder here either — a pin cannot make a thing happen sooner.
 */
export function sortByNextDue(tasks, today) {
  return [...tasks].sort((a, b) => {
    const left = daysUntilDue(a, today)
    const right = daysUntilDue(b, today)
    if (left === right) return a.name.localeCompare(b.name, 'pl')
    if (left === null) return 1
    if (right === null) return -1
    return left - right
  })
}

export function filterForView(tasks, view, today) {
  const active = tasks.filter((t) => !t.archived)
  switch (view) {
    case 'today':
      return active.filter((t) => ['due', 'overdue', 'done'].includes(computeStatus(t, today)))
    // Keyed off *when the next deadline falls*, not off today's status. Asking for
    // `later` looked equivalent and was not: a thing ticked off today reads `done`
    // for the rest of the day, so one done this morning and due again tomorrow
    // dropped out of the coming week entirely — the day strip showed bars for
    // tomorrow while this view said "Tu nic nie ma".
    //
    // `until > 0` is what keeps the two views apart: 0 is today (Dziś) and
    // negatives are arrears, which are also today's problem.
    case 'upcoming':
      return active.filter((t) => {
        const until = daysUntilDue(t, today)
        return until !== null && until > 0 && until <= 7
      })
    case 'archive':
      return tasks.filter((t) => t.archived)
    case 'all':
    default:
      return active
  }
}

export function filterByCategory(tasks, category) {
  return category ? tasks.filter((t) => t.category === category) : tasks
}

/** How much falls due on each of the next `days` days — data for the day strip. */
export function dayLoad(tasks, today, days = 12) {
  const active = tasks.filter((t) => !t.archived)

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - 1) // the first bar is yesterday, i.e. arrears
    const iso = toISODate(date)
    let count = 0
    let overdue = false

    for (const task of active) {
      const due = dueDate(task)
      if (!due) continue
      if (toISODate(due) === iso) {
        count++
        if (diffInDays(due, today) < 0) overdue = true
      }
    }

    return { date, count, overdue, isToday: diffInDays(date, today) === 0 }
  })
}

/** Counts behind the hero sentence: "Zostały dwie rzeczy i jedna zaległość." */
export function summarise(tasks, today) {
  const statuses = tasks.filter((t) => !t.archived).map((t) => computeStatus(t, today))
  return {
    overdue: statuses.filter((s) => s === 'overdue').length,
    due: statuses.filter((s) => s === 'due').length,
    doneToday: statuses.filter((s) => s === 'done').length,
  }
}

/**
 * Numbers behind the day's progress bar.
 *
 * The denominator is everything that fell due today or earlier *including* what
 * has already been ticked off. Drop the ticked-off ones and the bar would stand
 * still while the list empties, because numerator and denominator would fall
 * together. An empty day is `{ done: 0, total: 0 }`, which the bar reads as
 * done — nothing due is a success, not a zero.
 *
 * `wasLater` is asked about things completed today, so a "na spokojnie" thing
 * ticked off early stays out of the day's load: counting it would grow the
 * denominator at the moment of the tap and send the percentage backwards.
 */
export function dayProgress(tasks, today, wasLater = () => false) {
  let done = 0
  let total = 0

  for (const task of tasks) {
    if (task.archived) continue
    const status = computeStatus(task, today)
    if (status === 'later') continue
    if (status === 'done' && wasLater(task)) continue
    total++
    if (status === 'done') done++
  }

  return { done, total }
}

/**
 * Whether the day has been closed *and* the reward is allowed to say so.
 *
 * The second half is the part worth having a function for. "Everything due is
 * done" is true again on every visit for the rest of the day, but the reward may
 * only stand *above* the things just ticked off, never in their place — so it
 * needs at least one of them still on the list to stand above. Reopen the app
 * after the undo window has closed and the list still holds everything in "Na
 * spokojnie": not empty, yet with nothing to take back. Testing for a non-empty
 * list instead of for a visible completion is exactly that bug.
 */
export function dayClosed({ done, total }, onList, today) {
  if (total === 0 || done !== total) return false
  return onList.some((task) => computeStatus(task, today) === 'done')
}

/** Card-sized description: "co 3 dni", "co miesiąc, 1.", "co tydzień: pn, cz". */
export function describeInterval(interval) {
  switch (interval.type) {
    case 'daily':
      return 'codziennie'
    case 'everyNDays':
      return interval.n === 7 ? 'co tydzień' : `co ${interval.n} dni`
    case 'weekly': {
      const map = { 1: 'pn', 2: 'wt', 3: 'śr', 4: 'cz', 5: 'pt', 6: 'sb', 7: 'nd' }
      const days = (interval.weekdays || []).map((d) => map[d]).join(', ')
      return days ? `co tydzień: ${days}` : 'co tydzień'
    }
    case 'monthly': {
      const every = Math.max(1, interval.every ?? 1)

      // A year carries no day rule — the anchor holds the month and the day —
      // so there is nothing to append after the cadence.
      if (interval.unit === 'year') {
        return every === 1 ? 'co rok' : `co ${countWith(every, FORMS.rok)}`
      }

      const cadence = every === 1 ? 'co miesiąc' : `co ${countWith(every, FORMS.miesiac)}`
      if (interval.day === 'first') return `${cadence}, 1.`
      if (interval.day === 'last') return `${cadence}, ostatniego`
      if (typeof interval.day === 'object' && interval.day !== null) {
        const nth = ORDINALS_ACCUSATIVE[interval.day.nth - 1] ?? ORDINALS_ACCUSATIVE[0]
        return `${cadence}, w ${nth} ${WEEKDAYS_ACCUSATIVE[interval.day.weekday] ?? 'sobotę'}`
      }
      if (interval.day === undefined || interval.day === null) return cadence
      return `${cadence}, ${interval.day}.`
    }
    case 'manual':
    default:
      return 'bez rytmu'
  }
}

/**
 * Stable identity for an interval, so "did the rhythm actually change?" doesn't
 * depend on key order. It does: an interval read back from the API and one
 * rebuilt by the editor carry the same fields in a different order.
 */
export function intervalKey(interval) {
  return JSON.stringify({
    type: interval.type,
    n: interval.n ?? null,
    startsOn: interval.startsOn ?? null,
    weekdays: interval.weekdays ?? null,
    day: interval.day ?? null,
    // Normalised rather than passed through: a row written before migration
    // 0008 reads back without these, and it must compare equal to the same
    // rhythm rebuilt by the editor, or the sheet would ask about a rebase
    // nobody requested.
    every: interval.type === 'monthly' ? Math.max(1, interval.every ?? 1) : null,
    unit: interval.type === 'monthly' ? (interval.unit === 'year' ? 'year' : 'month') : null,
  })
}

/**
 * Changing a rhythm on an existing task moves its next deadline, so the editor
 * asks what to count from. 'lastDone' keeps the anchor where it is; 'today'
 * restarts the grid from now.
 */
export function rebaseInterval(interval, today, choice) {
  if (interval.type === 'manual' || choice !== 'today') return interval
  return { ...interval, startsOn: toISODate(today) }
}
