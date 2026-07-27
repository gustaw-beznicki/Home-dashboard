import { describe, expect, it } from 'vitest'
import { countWith, FORMS, formatLastDone, plural, relativeDue, slownie, summarySentence } from './plural'

describe('plural', () => {
  it('picks the singular, the 2–4 form and the many form', () => {
    expect(plural(1, FORMS.dzien)).toBe('dzień')
    expect(plural(3, FORMS.dzien)).toBe('dni')
    expect(plural(5, FORMS.dzien)).toBe('dni')
    expect(plural(1, FORMS.tydzien)).toBe('tydzień')
    expect(plural(3, FORMS.tydzien)).toBe('tygodnie')
    expect(plural(5, FORMS.tydzien)).toBe('tygodni')
  })

  it('applies the teens exception — 12 takes the many form, 22 does not', () => {
    expect(plural(12, FORMS.tydzien)).toBe('tygodni')
    expect(plural(13, FORMS.tydzien)).toBe('tygodni')
    expect(plural(14, FORMS.tydzien)).toBe('tygodni')
    expect(plural(22, FORMS.tydzien)).toBe('tygodnie')
    expect(countWith(22, FORMS.dzien)).toBe('22 dni')
  })
})

describe('relativeDue', () => {
  it('prefers words to numbers wherever Polish has one', () => {
    expect(relativeDue(0)).toBe('na dziś')
    expect(relativeDue(1)).toBe('jutro')
    expect(relativeDue(2)).toBe('pojutrze')
    expect(relativeDue(7)).toBe('za tydzień')
    expect(relativeDue(14)).toBe('za dwa tygodnie')
    expect(relativeDue(21)).toBe('za 3 tygodnie')
    expect(relativeDue(4)).toBe('za 4 dni')
  })

  it('says how late something is rather than showing a negative number', () => {
    expect(relativeDue(-1)).toBe('dzień po terminie')
    expect(relativeDue(-3)).toBe('3 dni po terminie')
  })
})

describe('summarySentence', () => {
  it('agrees the verb with the leading noun phrase', () => {
    expect(summarySentence({ overdue: 1, due: 2, doneToday: 0 })).toBe(
      'Zostały dwie rzeczy i jedna zaległość.'
    )
    expect(summarySentence({ overdue: 0, due: 1, doneToday: 0 })).toBe('Została jedna rzecz.')
    expect(summarySentence({ overdue: 1, due: 0, doneToday: 0 })).toBe('Została jedna zaległość.')
    expect(summarySentence({ overdue: 3, due: 0, doneToday: 0 })).toBe('Zostały trzy zaległości.')
  })

  it('treats an empty day as a reward, not a void', () => {
    expect(summarySentence({ overdue: 0, due: 0, doneToday: 0 })).toBe(
      'Na dziś nic. Dom się sam ogarnął.'
    )
    expect(summarySentence({ overdue: 0, due: 0, doneToday: 2 })).toBe(
      'Na dziś nic więcej. Dom ogarnięty.'
    )
  })
})

describe('slownie / formatLastDone', () => {
  it('spells small numbers out for sentences', () => {
    expect(slownie(2, FORMS.rzecz)).toBe('dwie rzeczy')
    expect(slownie(11, FORMS.rzecz)).toBe('11 rzeczy')
  })

  it('names the person and the day, with "nigdy" when never done', () => {
    const today = new Date(2026, 6, 24)
    expect(formatLastDone(null, today, 'Anna')).toBe('nigdy')
    expect(formatLastDone(new Date(2026, 6, 24), today, 'Anna')).toBe('Anna, dziś')
    expect(formatLastDone(new Date(2026, 6, 23), today, 'Anna')).toBe('Anna, wczoraj')
    expect(formatLastDone(new Date(2026, 6, 20), today, 'Anna')).toBe('Anna, 20 lipca')
  })

  it('says "dziś" whatever the time of day is', () => {
    // The regression this guards: `today` is a live clock, a completion date is
    // midnight, and rounding the gap in milliseconds flipped to "wczoraj" from
    // noon onwards. Comparing two midnights, as the test above does, never
    // reaches that.
    const done = new Date(2026, 6, 24)
    for (const hour of [0, 11, 12, 13, 18, 23]) {
      const now = new Date(2026, 6, 24, hour, 30)
      expect(formatLastDone(done, now, 'Anna'), `${hour}:30`).toBe('Anna, dziś')
    }
    expect(formatLastDone(new Date(2026, 6, 23), new Date(2026, 6, 24, 18, 30))).toBe('wczoraj')
  })
})
