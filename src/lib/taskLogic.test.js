import { describe, expect, it } from 'vitest'
import {
  computeKpi,
  computeStatus,
  daysUntilDue,
  filterForTab,
  isWithinNextDays,
  nextDueDate,
  sortByUrgency,
  toISODate,
} from './taskLogic'

const TODAY = new Date(2026, 6, 24) // 2026-07-24, matches system clock in this environment

function daysAgo(n, from = TODAY) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

function baseTask(overrides) {
  return {
    id: 't1',
    name: 'Test task',
    lastDone: null,
    interval: { type: 'daily' },
    priority: 'medium',
    note: '',
    category: 'home',
    pinned: false,
    archived: false,
    ...overrides,
  }
}

describe('computeStatus', () => {
  it('returns overdue for a recurring task never done', () => {
    const task = baseTask({ interval: { type: 'daily' }, lastDone: null })
    expect(computeStatus(task, TODAY)).toBe('overdue')
  })

  it('returns inactive for a manual task never done', () => {
    const task = baseTask({ interval: { type: 'manual' }, lastDone: null })
    expect(computeStatus(task, TODAY)).toBe('inactive')
  })

  it('returns done for a manual task completed today', () => {
    const task = baseTask({ interval: { type: 'manual' }, lastDone: toISODate(TODAY) })
    expect(computeStatus(task, TODAY)).toBe('done')
  })

  it('returns inactive for a manual task completed yesterday (not today)', () => {
    const task = baseTask({ interval: { type: 'manual' }, lastDone: daysAgo(1) })
    expect(computeStatus(task, TODAY)).toBe('inactive')
  })

  describe('daily', () => {
    const interval = { type: 'daily' }
    it('done when completed today', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(0) }), TODAY)).toBe('done')
    })
    it('due when completed yesterday', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(1) }), TODAY)).toBe('due')
    })
    it('overdue when completed 2+ days ago', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(2) }), TODAY)).toBe('overdue')
    })
  })

  describe('everyNDays (n=3)', () => {
    const interval = { type: 'everyNDays', n: 3 }
    it('done on day 0', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(0) }), TODAY)).toBe('done')
    })
    it('inactive ("for later") on days 1-2', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(1) }), TODAY)).toBe('inactive')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(2) }), TODAY)).toBe('inactive')
    })
    it('due exactly on day 3', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(3) }), TODAY)).toBe('due')
    })
    it('overdue after day 3', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(4) }), TODAY)).toBe('overdue')
    })
  })

  describe('weekly', () => {
    const interval = { type: 'weekly' }
    it('inactive before day 7, due on day 7, overdue after', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(6) }), TODAY)).toBe('inactive')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(7) }), TODAY)).toBe('due')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(8) }), TODAY)).toBe('overdue')
    })
  })

  describe('monthly', () => {
    const interval = { type: 'monthly' }
    it('inactive before day 30, due on day 30, overdue after', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(29) }), TODAY)).toBe('inactive')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(30) }), TODAY)).toBe('due')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(31) }), TODAY)).toBe('overdue')
    })
  })
})

describe('day-rollover correctness', () => {
  it('flips a task from due to overdue when `today` advances by one day', () => {
    const task = baseTask({ interval: { type: 'daily' }, lastDone: daysAgo(1) })
    expect(computeStatus(task, TODAY)).toBe('due')

    const tomorrow = new Date(TODAY)
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(computeStatus(task, tomorrow)).toBe('overdue')
  })

  it('flips a task from inactive to done the instant it is marked done, independent of time of day', () => {
    const task = baseTask({ interval: { type: 'everyNDays', n: 3 }, lastDone: daysAgo(1) })
    expect(computeStatus(task, TODAY)).toBe('inactive')

    const justBeforeMidnight = new Date(TODAY)
    justBeforeMidnight.setHours(23, 59)
    const markedDone = { ...task, lastDone: toISODate(justBeforeMidnight) }
    expect(computeStatus(markedDone, justBeforeMidnight)).toBe('done')

    const justAfterMidnight = new Date(justBeforeMidnight)
    justAfterMidnight.setDate(justAfterMidnight.getDate() + 1)
    justAfterMidnight.setHours(0, 1)
    expect(computeStatus(markedDone, justAfterMidnight)).toBe('inactive')
  })
})

describe('nextDueDate / daysUntilDue / isWithinNextDays', () => {
  it('has no next due date for manual tasks', () => {
    const task = baseTask({ interval: { type: 'manual' }, lastDone: daysAgo(0) })
    expect(nextDueDate(task)).toBeNull()
    expect(daysUntilDue(task, TODAY)).toBeNull()
  })

  it('computes days until due for a weekly task', () => {
    const task = baseTask({ interval: { type: 'weekly' }, lastDone: daysAgo(2) })
    expect(daysUntilDue(task, TODAY)).toBe(5)
    expect(isWithinNextDays(task, 7, TODAY)).toBe(true)
    expect(isWithinNextDays(task, 4, TODAY)).toBe(false)
  })
})

describe('sortByUrgency', () => {
  it('sorts pinned first, then by status severity, then by proximity', () => {
    const overdue = baseTask({ id: 'overdue', interval: { type: 'daily' }, lastDone: daysAgo(3) })
    const due = baseTask({ id: 'due', interval: { type: 'daily' }, lastDone: daysAgo(1) })
    const inactive = baseTask({
      id: 'inactive',
      interval: { type: 'weekly' },
      lastDone: daysAgo(1),
    })
    const pinnedInactive = baseTask({
      id: 'pinned',
      interval: { type: 'weekly' },
      lastDone: daysAgo(1),
      pinned: true,
    })

    const sorted = sortByUrgency([inactive, due, overdue, pinnedInactive], TODAY)
    expect(sorted.map((t) => t.id)).toEqual(['pinned', 'overdue', 'due', 'inactive'])
  })
})

describe('filterForTab', () => {
  const overdue = baseTask({ id: 'overdue', interval: { type: 'daily' }, lastDone: daysAgo(3) })
  const due = baseTask({ id: 'due', interval: { type: 'daily' }, lastDone: daysAgo(1) })
  const upcoming = baseTask({
    id: 'upcoming',
    interval: { type: 'weekly' },
    lastDone: daysAgo(2),
  })
  const archived = baseTask({ id: 'archived', archived: true })
  const tasks = [overdue, due, upcoming, archived]

  it('today tab includes only due/overdue, excludes archived', () => {
    expect(filterForTab(tasks, 'today', TODAY).map((t) => t.id).sort()).toEqual([
      'due',
      'overdue',
    ])
  })

  it('upcoming tab includes tasks due within 7 days that are not yet due', () => {
    expect(filterForTab(tasks, 'upcoming', TODAY).map((t) => t.id)).toEqual(['upcoming'])
  })

  it('all tab excludes archived', () => {
    expect(filterForTab(tasks, 'all', TODAY).map((t) => t.id).sort()).toEqual([
      'due',
      'overdue',
      'upcoming',
    ])
  })

  it('archive tab includes only archived', () => {
    expect(filterForTab(tasks, 'archive', TODAY).map((t) => t.id)).toEqual(['archived'])
  })
})

describe('computeKpi', () => {
  it('computes done/total/percent among tasks that were due today (excludes inactive/archived)', () => {
    const done = baseTask({ id: 'd', interval: { type: 'daily' }, lastDone: daysAgo(0) })
    const due = baseTask({ id: 'u', interval: { type: 'daily' }, lastDone: daysAgo(1) })
    const inactive = baseTask({ id: 'i', interval: { type: 'weekly' }, lastDone: daysAgo(1) })

    const kpi = computeKpi([done, due, inactive], TODAY)
    expect(kpi).toEqual({ doneCount: 1, totalDue: 2, percent: 50 })
  })

  it('reports 100% when there are no relevant tasks', () => {
    expect(computeKpi([], TODAY)).toEqual({ doneCount: 0, totalDue: 0, percent: 100 })
  })
})
