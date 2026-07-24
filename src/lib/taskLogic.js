// Pure, framework-independent task logic. Every function takes `today` explicitly
// (never reads the system clock internally) so behavior is deterministic and testable.

function toMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function toISODate(date) {
  const d = toMidnight(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diffInDays(laterDate, earlierDate) {
  return Math.round((toMidnight(laterDate) - toMidnight(earlierDate)) / 86400000)
}

export function getIntervalDays(interval) {
  switch (interval.type) {
    case 'daily':
      return 1
    case 'everyNDays':
      return interval.n
    case 'weekly':
      return 7
    case 'monthly':
      return 30
    case 'manual':
      return null
    default:
      return null
  }
}

/**
 * Returns 'done' | 'due' | 'overdue' | 'inactive'.
 * 'inactive' also covers "not due yet" (the gray/"for later" bucket) for recurring
 * tasks that were done recently enough, and manual tasks not done today.
 */
export function computeStatus(task, today = new Date()) {
  const { interval, lastDone } = task

  if (interval.type === 'manual') {
    return lastDone === toISODate(today) ? 'done' : 'inactive'
  }

  if (!lastDone) return 'overdue'

  const n = getIntervalDays(interval)
  const daysSince = diffInDays(today, parseISODate(lastDone))

  if (daysSince <= 0) return 'done'
  if (daysSince < n) return 'inactive'
  if (daysSince === n) return 'due'
  return 'overdue'
}

// Next scheduled due date for recurring tasks. Null for manual tasks or tasks
// never done yet (those are already overdue "now", not scheduled for later).
export function nextDueDate(task) {
  if (task.interval.type === 'manual' || !task.lastDone) return null
  const n = getIntervalDays(task.interval)
  const next = parseISODate(task.lastDone)
  next.setDate(next.getDate() + n)
  return next
}

// Days from `today` until the task's next due date. Null if not applicable
// (manual, or never done — those show up via computeStatus === 'overdue' instead).
export function daysUntilDue(task, today = new Date()) {
  const next = nextDueDate(task)
  if (!next) return null
  return diffInDays(next, today)
}

export function isWithinNextDays(task, days, today = new Date()) {
  const until = daysUntilDue(task, today)
  return until !== null && until >= 0 && until <= days
}

const STATUS_RANK = { overdue: 0, due: 1, inactive: 2, done: 3 }

export function sortByUrgency(tasks, today = new Date()) {
  return [...tasks].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

    const statusDiff = STATUS_RANK[computeStatus(a, today)] - STATUS_RANK[computeStatus(b, today)]
    if (statusDiff !== 0) return statusDiff

    const aUntil = daysUntilDue(a, today)
    const bUntil = daysUntilDue(b, today)
    if (aUntil !== bUntil) {
      if (aUntil === null) return 1
      if (bUntil === null) return -1
      return aUntil - bUntil
    }

    return a.name.localeCompare(b.name)
  })
}

export function filterForTab(tasks, tab, today = new Date()) {
  const active = tasks.filter((t) => !t.archived)
  switch (tab) {
    case 'today':
      return active.filter((t) => {
        const s = computeStatus(t, today)
        return s === 'due' || s === 'overdue'
      })
    case 'upcoming':
      return active.filter(
        (t) => computeStatus(t, today) === 'inactive' && isWithinNextDays(t, 7, today)
      )
    case 'all':
      return active
    case 'archive':
      return tasks.filter((t) => t.archived)
    default:
      return active
  }
}

export function filterByCategory(tasks, category) {
  if (!category) return tasks
  return tasks.filter((t) => t.category === category)
}

export function computeKpi(tasks, today = new Date()) {
  const relevant = tasks
    .filter((t) => !t.archived)
    .map((t) => computeStatus(t, today))
    .filter((s) => s === 'done' || s === 'due' || s === 'overdue')

  const doneCount = relevant.filter((s) => s === 'done').length
  const totalDue = relevant.length
  const percent = totalDue > 0 ? Math.round((100 * doneCount) / totalDue) : 100

  return { doneCount, totalDue, percent }
}
