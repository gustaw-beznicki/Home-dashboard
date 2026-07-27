import { describe, expect, it } from 'vitest'
import { CHORE_CATALOG } from './choreCatalog'
import { fold } from './choreSearch'
import { CATEGORIES, RHYTHMS } from './constants'
import { computeStatus, toISODate } from './recurrence'

// Two hundred rows written by hand are data, and data rots quietly. These are
// the invariants the rest of the app assumes; a typo in one entry fails here
// rather than showing up as a chore that never comes due.

const CATEGORY_KEYS = CATEGORIES.map((category) => category.key)
const RHYTHM_TYPES = RHYTHMS.map((rhythm) => rhythm.type)

describe('chore catalog', () => {
  it('is big enough to be worth searching', () => {
    expect(CHORE_CATALOG.length).toBeGreaterThanOrEqual(150)
  })

  it('has unique ids', () => {
    const ids = CHORE_CATALOG.map((chore) => chore.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has ids that are stable kebab-case slugs', () => {
    for (const chore of CHORE_CATALOG) {
      expect(chore.id, chore.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('has no two entries the search could not tell apart', () => {
    const names = CHORE_CATALOG.map((chore) => fold(chore.name))
    expect(new Set(names).size).toBe(names.length)
  })

  it('names something in every entry', () => {
    for (const chore of CHORE_CATALOG) {
      expect(chore.name.trim(), chore.id).toBe(chore.name)
      expect(chore.name.length, chore.id).toBeGreaterThan(2)
    }
  })

  it('uses only built-in category keys', () => {
    for (const chore of CHORE_CATALOG) {
      expect(CATEGORY_KEYS, chore.id).toContain(chore.category)
    }
  })

  it('covers every category', () => {
    const covered = new Set(CHORE_CATALOG.map((chore) => chore.category))
    expect([...covered].sort()).toEqual([...CATEGORY_KEYS].sort())
  })

  it('uses only known rhythm types', () => {
    for (const chore of CHORE_CATALOG) {
      expect(RHYTHM_TYPES, chore.id).toContain(chore.interval.type)
    }
  })

  it('never ships an anchor', () => {
    // startsOn is stamped from today when the suggestion is picked (ADR 0010).
    // A canned date in the catalog would be wrong for every household.
    for (const chore of CHORE_CATALOG) {
      expect(chore.interval.startsOn, chore.id).toBeUndefined()
    }
  })

  it('carries the fields each rhythm type needs', () => {
    for (const { id, interval } of CHORE_CATALOG) {
      if (interval.type === 'everyNDays') {
        expect(interval.n, id).toBeGreaterThan(1)
      }
      if (interval.type === 'weekly') {
        expect(interval.weekdays, id).toBeInstanceOf(Array)
        expect(interval.weekdays.length, id).toBeGreaterThan(0)
        for (const day of interval.weekdays) expect(day, id).toBeGreaterThanOrEqual(1)
        for (const day of interval.weekdays) expect(day, id).toBeLessThanOrEqual(7)
      }
      if (interval.type === 'monthly') {
        const day = interval.day
        const valid = day === 'first' || day === 'last' || (Number.isInteger(day) && day >= 1 && day <= 28)
        expect(valid, `${id}: ${JSON.stringify(day)}`).toBe(true)
      }
      if (interval.type === 'daily' || interval.type === 'manual') {
        expect(Object.keys(interval), id).toEqual(['type'])
      }
    }
  })

  it('gives every entry keywords the search can use', () => {
    for (const chore of CHORE_CATALOG) {
      expect(chore.keywords.length, chore.id).toBeGreaterThanOrEqual(2)
      const folded = chore.keywords.map(fold)
      expect(folded.every(Boolean), chore.id).toBe(true)
      expect(new Set(folded).size, chore.id).toBe(folded.length)
    }
  })

  it('produces a task that comes due rather than one stuck in "later"', () => {
    // Every suggestion is anchored on today when picked, so its first deadline
    // is today — the new task lands in "Na dziś", not somewhere invisible.
    const today = new Date(2026, 6, 27)
    for (const chore of CHORE_CATALOG) {
      const task = {
        name: chore.name,
        interval: { ...chore.interval, startsOn: toISODate(today) },
        lastDone: null,
      }
      expect(computeStatus(task, today), chore.id).not.toBe('overdue')
    }
  })
})
