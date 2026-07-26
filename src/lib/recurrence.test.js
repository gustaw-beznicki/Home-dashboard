import { describe, expect, it } from 'vitest'
import {
  computeStatus,
  dayLoad,
  daysUntilDue,
  describeInterval,
  dueDate,
  filterForView,
  groupTasks,
  rebaseInterval,
  sortByUrgency,
  summarise,
  toISODate,
  upcomingOccurrences,
} from './recurrence'

const TODAY = new Date(2026, 6, 24) // Friday 2026-07-24

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
    interval: { type: 'daily', startsOn: daysAgo(30) },
    note: '',
    category: 'home',
    pinned: false,
    archived: false,
    ...overrides,
  }
}

describe('computeStatus', () => {
  it('is overdue for a recurring task never done whose anchor has passed', () => {
    expect(computeStatus(baseTask({ lastDone: null }), TODAY)).toBe('overdue')
  })

  it('is later for a recurring task whose anchor is still in the future', () => {
    const task = baseTask({ interval: { type: 'daily', startsOn: daysAgo(-3) }, lastDone: null })
    expect(computeStatus(task, TODAY)).toBe('later')
    expect(daysUntilDue(task, TODAY)).toBe(3)
  })

  it('is overdue for a recurring task with no anchor at all', () => {
    // Nothing to count from — parking it in "later" would hide it forever.
    expect(computeStatus(baseTask({ interval: { type: 'daily' } }), TODAY)).toBe('overdue')
  })

  it('is later for a manual task never done, done only on the day it was ticked', () => {
    const interval = { type: 'manual' }
    expect(computeStatus(baseTask({ interval, lastDone: null }), TODAY)).toBe('later')
    expect(computeStatus(baseTask({ interval, lastDone: daysAgo(0) }), TODAY)).toBe('done')
    expect(computeStatus(baseTask({ interval, lastDone: daysAgo(1) }), TODAY)).toBe('later')
  })

  describe('daily', () => {
    const interval = { type: 'daily', startsOn: daysAgo(30) }
    it('done today, due the next day, overdue after that', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(0) }), TODAY)).toBe('done')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(1) }), TODAY)).toBe('due')
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(2) }), TODAY)).toBe('overdue')
    })
  })

  describe('everyNDays (n=3)', () => {
    // Anchored on 3 July, so the grid runs … 07-18, 07-21, 07-24, 07-27 …
    const interval = { type: 'everyNDays', n: 3, startsOn: '2026-07-03' }

    it('is done on the day it was ticked', () => {
      expect(computeStatus(baseTask({ interval, lastDone: daysAgo(0) }), TODAY)).toBe('done')
    })

    it('is due when the next grid point is today', () => {
      expect(computeStatus(baseTask({ interval, lastDone: '2026-07-21' }), TODAY)).toBe('due')
    })

    it('is overdue when a grid point was missed', () => {
      const task = baseTask({ interval, lastDone: '2026-07-18' })
      expect(computeStatus(task, TODAY)).toBe('overdue')
      expect(daysUntilDue(task, TODAY)).toBe(-3)
    })

    it('keeps deadlines on the anchor grid rather than re-basing on a late completion', () => {
      // Done a day late, on 22 July. The next deadline is the grid's 24 July,
      // not 25 July — which is what "3 days after you last did it" would give.
      const task = baseTask({ interval, lastDone: '2026-07-22' })
      expect(toISODate(dueDate(task))).toBe('2026-07-24')
      expect(daysUntilDue(task, TODAY)).toBe(0)
    })
  })

  describe('weekly', () => {
    it('lands on the next listed weekday', () => {
      // Monday and Thursday; TODAY is a Friday, done yesterday (Thursday).
      const task = baseTask({
        interval: { type: 'weekly', weekdays: [1, 4], startsOn: daysAgo(30) },
        lastDone: daysAgo(1),
      })
      expect(toISODate(dueDate(task))).toBe('2026-07-27') // the following Monday
      expect(computeStatus(task, TODAY)).toBe('later')
    })

    it('falls back to the anchor weekday when no days are selected', () => {
      const task = baseTask({
        interval: { type: 'weekly', startsOn: '2026-07-17' }, // a Friday
        lastDone: '2026-07-17',
      })
      expect(toISODate(dueDate(task))).toBe('2026-07-24')
    })
  })

  describe('monthly', () => {
    it('supports the first of the month', () => {
      const task = baseTask({
        interval: { type: 'monthly', day: 'first', startsOn: '2026-01-01' },
        lastDone: '2026-07-01',
      })
      expect(toISODate(dueDate(task))).toBe('2026-08-01')
    })

    it('supports the last day, clamping to the length of the month', () => {
      const task = baseTask({
        interval: { type: 'monthly', day: 'last', startsOn: '2026-01-31' },
        lastDone: '2026-01-31',
      })
      expect(toISODate(dueDate(task))).toBe('2026-02-28')
    })

    it('supports a fixed day number', () => {
      const task = baseTask({
        interval: { type: 'monthly', day: 15, startsOn: '2026-01-15' },
        lastDone: '2026-07-15',
      })
      expect(toISODate(dueDate(task))).toBe('2026-08-15')
    })

    it('supports the nth weekday of the month', () => {
      const task = baseTask({
        interval: { type: 'monthly', day: { nth: 1, weekday: 6 }, startsOn: '2026-01-01' },
        lastDone: '2026-07-04',
      })
      expect(toISODate(dueDate(task))).toBe('2026-08-01') // first Saturday of August
    })
  })
})

describe('day-rollover correctness', () => {
  it('flips a task from due to overdue when `today` advances by one day', () => {
    const task = baseTask({ lastDone: daysAgo(1) })
    expect(computeStatus(task, TODAY)).toBe('due')

    const tomorrow = new Date(TODAY)
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(computeStatus(task, tomorrow)).toBe('overdue')
  })

  it('flips due → done → later around a tick, independent of time of day', () => {
    const interval = { type: 'everyNDays', n: 3, startsOn: '2026-07-03' }
    const task = baseTask({ interval, lastDone: '2026-07-21' })
    expect(computeStatus(task, TODAY)).toBe('due')

    const justBeforeMidnight = new Date(TODAY)
    justBeforeMidnight.setHours(23, 59)
    const ticked = { ...task, lastDone: toISODate(justBeforeMidnight) }
    expect(computeStatus(ticked, justBeforeMidnight)).toBe('done')

    const justAfterMidnight = new Date(justBeforeMidnight)
    justAfterMidnight.setDate(justAfterMidnight.getDate() + 1)
    justAfterMidnight.setHours(0, 1)
    // The next grid point is 27 July, so it settles into "Na spokojnie".
    expect(computeStatus(ticked, justAfterMidnight)).toBe('later')
  })
})

describe('upcomingOccurrences', () => {
  it('previews the next three deadlines, including one falling today', () => {
    const interval = { type: 'everyNDays', n: 2, startsOn: toISODate(TODAY) }
    expect(upcomingOccurrences(interval, TODAY, 3).map(toISODate)).toEqual([
      '2026-07-24',
      '2026-07-26',
      '2026-07-28',
    ])
  })

  it('previews nothing for a manual rhythm', () => {
    expect(upcomingOccurrences({ type: 'manual' }, TODAY, 3)).toEqual([])
  })
})

describe('sortByUrgency', () => {
  it('sorts pinned first, then by status severity, then by proximity', () => {
    const overdue = baseTask({ id: 'overdue', lastDone: daysAgo(3) })
    const due = baseTask({ id: 'due', lastDone: daysAgo(1) })
    const later = baseTask({
      id: 'later',
      interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-20' },
      lastDone: '2026-07-20',
    })
    const pinned = { ...later, id: 'pinned', pinned: true }

    const sorted = sortByUrgency([later, due, overdue, pinned], TODAY)
    expect(sorted.map((t) => t.id)).toEqual(['pinned', 'overdue', 'due', 'later'])
  })
})

describe('groupTasks', () => {
  const overdue = baseTask({ id: 'overdue', lastDone: daysAgo(3) })
  const due = baseTask({ id: 'due', lastDone: daysAgo(1) })
  const later = baseTask({
    id: 'later',
    interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-20' },
    lastDone: '2026-07-20',
  })

  it('splits into the three dashboard stops', () => {
    const groups = groupTasks([later, due, overdue], TODAY)
    expect(groups.overdue.map((t) => t.id)).toEqual(['overdue'])
    expect(groups.due.map((t) => t.id)).toEqual(['due'])
    expect(groups.later.map((t) => t.id)).toEqual(['later'])
  })

  it('keeps a task ticked off today in the group it was ticked off in', () => {
    const ticked = { ...overdue, lastDone: daysAgo(0) }
    const sticky = new Map([[ticked.id, 'overdue']])

    expect(groupTasks([ticked], TODAY, sticky).overdue.map((t) => t.id)).toEqual(['overdue'])
    // Without the sticky record it falls back to the "Na dziś" stop.
    expect(groupTasks([ticked], TODAY).due.map((t) => t.id)).toEqual(['overdue'])
  })
})

describe('filterForView', () => {
  const overdue = baseTask({ id: 'overdue', lastDone: daysAgo(3) })
  const due = baseTask({ id: 'due', lastDone: daysAgo(1) })
  const upcoming = baseTask({
    id: 'upcoming',
    interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-20' }, // next: 27 July
    lastDone: '2026-07-20',
  })
  const distant = baseTask({
    id: 'distant',
    interval: { type: 'everyNDays', n: 30, startsOn: '2026-07-20' }, // next: 19 August
    lastDone: '2026-07-20',
  })
  const archived = baseTask({ id: 'archived', archived: true })
  const tasks = [overdue, due, upcoming, distant, archived]

  it('today: due, overdue and just-completed, never archived', () => {
    expect(
      filterForView(tasks, 'today', TODAY)
        .map((t) => t.id)
        .sort()
    ).toEqual(['due', 'overdue'])
  })

  it('upcoming: not yet due, but within the week', () => {
    expect(filterForView(tasks, 'upcoming', TODAY).map((t) => t.id)).toEqual(['upcoming'])
  })

  it('all: everything unarchived', () => {
    expect(filterForView(tasks, 'all', TODAY).map((t) => t.id)).not.toContain('archived')
  })

  it('archive: only archived', () => {
    expect(filterForView(tasks, 'archive', TODAY).map((t) => t.id)).toEqual(['archived'])
  })
})

describe('summarise', () => {
  it('counts the three states behind the hero sentence, ignoring archived', () => {
    const tasks = [
      baseTask({ id: 'a', lastDone: daysAgo(3) }),
      baseTask({ id: 'b', lastDone: daysAgo(1) }),
      baseTask({ id: 'c', lastDone: daysAgo(1) }),
      baseTask({ id: 'd', lastDone: daysAgo(0) }),
      baseTask({ id: 'e', lastDone: daysAgo(3), archived: true }),
    ]
    expect(summarise(tasks, TODAY)).toEqual({ overdue: 1, due: 2, doneToday: 1 })
  })
})

describe('dayLoad', () => {
  it('starts at yesterday so arrears get a bar, and flags today', () => {
    const load = dayLoad([baseTask({ lastDone: daysAgo(2) })], TODAY, 3)
    expect(load.map((d) => toISODate(d.date))).toEqual(['2026-07-23', '2026-07-24', '2026-07-25'])
    expect(load[1].isToday).toBe(true)
    // Due two days ago, so it lands in the arrears bar with the overdue flag.
    expect(load[0]).toMatchObject({ count: 1, overdue: true })
  })
})

describe('rebaseInterval', () => {
  it('moves the anchor to today only when asked to start over', () => {
    const interval = { type: 'everyNDays', n: 3, startsOn: daysAgo(9) }
    expect(rebaseInterval(interval, TODAY, 'lastDone')).toBe(interval)
    expect(rebaseInterval(interval, TODAY, 'today').startsOn).toBe(toISODate(TODAY))
    expect(rebaseInterval({ type: 'manual' }, TODAY, 'today')).toEqual({ type: 'manual' })
  })
})

describe('describeInterval', () => {
  it('describes every rhythm in the vocabulary the cards use', () => {
    expect(describeInterval({ type: 'daily' })).toBe('codziennie')
    expect(describeInterval({ type: 'everyNDays', n: 3 })).toBe('co 3 dni')
    expect(describeInterval({ type: 'everyNDays', n: 7 })).toBe('co tydzień')
    expect(describeInterval({ type: 'weekly', weekdays: [1, 4] })).toBe('co tydzień: pn, cz')
    expect(describeInterval({ type: 'monthly', day: 'first' })).toBe('co miesiąc, 1.')
    expect(describeInterval({ type: 'monthly', day: 'last' })).toBe('co miesiąc, ostatniego')
    expect(describeInterval({ type: 'monthly', day: 12 })).toBe('co miesiąc, 12.')
    expect(describeInterval({ type: 'manual' })).toBe('bez rytmu')
  })
})
