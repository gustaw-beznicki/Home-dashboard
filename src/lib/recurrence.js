// Pure rhythm and status logic. Every function takes `today` explicitly and
// never reads the system clock — that property is what makes it testable, so
// keep it. Supersedes the old taskLogic.js, which had no anchor date.
//
// Interval model:
//   { type: 'daily',       startsOn }
//   { type: 'everyNDays',  n, startsOn }
//   { type: 'weekly',      weekdays: [1..7], startsOn }   // 1 = Monday
//   { type: 'monthly',     day: 1..28 | 'first' | 'last' | { nth: 1..4, weekday: 1..7 }, startsOn }
//   { type: 'manual' }
//
// `startsOn` is the anchor: an ISO date that fixes the grid of deadlines. The
// first deadline is `startsOn` itself; later ones are counted from it, and once
// a task is completed the next deadline is the first grid point after
// `lastDone`. Without an anchor "every 3 days" has nothing to hang off, which
// is the whole reason it is never hidden in the editor.

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

/**
 * First grid point strictly after `after` — or `startsOn` itself when the task
 * has never been done. Null for manual rhythms and for anchorless intervals.
 */
export function nextOccurrenceAfter(interval, after) {
  if (interval.type === 'manual') return null
  const start = anchorOf(interval)
  if (!start) return null
  if (!after || toMidnight(after) < start) return start

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
      const days = (
        interval.weekdays && interval.weekdays.length ? interval.weekdays : [isoWeekday(start)]
      )
        .slice()
        .sort((a, b) => a - b)
      for (let i = 1; i <= 7; i++) {
        const candidate = addDays(from, i)
        if (days.includes(isoWeekday(candidate))) return candidate
      }
      return addDays(from, 7)
    }

    case 'monthly': {
      const rule = interval.day ?? start.getDate()
      // 14 probes rather than 1: an nth-weekday rule can miss a short month.
      for (let i = 0; i <= 14; i++) {
        const probe = new Date(from.getFullYear(), from.getMonth() + i, 1)
        const date = monthlyDateFor(probe.getFullYear(), probe.getMonth(), rule)
        if (date && date > from && date >= start) return date
      }
      return null
    }

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

export function filterForView(tasks, view, today) {
  const active = tasks.filter((t) => !t.archived)
  switch (view) {
    case 'today':
      return active.filter((t) => ['due', 'overdue', 'done'].includes(computeStatus(t, today)))
    case 'upcoming':
      return active.filter((t) => {
        const until = daysUntilDue(t, today)
        return computeStatus(t, today) === 'later' && until !== null && until <= 7
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
      if (interval.day === 'first') return 'co miesiąc, 1.'
      if (interval.day === 'last') return 'co miesiąc, ostatniego'
      if (typeof interval.day === 'object' && interval.day !== null) {
        return 'co miesiąc, w pierwszą sobotę'
      }
      return `co miesiąc, ${interval.day}.`
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
