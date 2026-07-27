import { describe, expect, it } from 'vitest'
import { buildIndex, fold, searchChores, tokenize } from './choreSearch'

// A tiny fixture catalog so ranking assertions don't shift every time someone
// adds a chore to the real one. The shipped catalog has its own test file.
const CATALOG = buildIndex([
  {
    id: 'water-plants',
    name: 'Podlać kwiaty',
    category: 'plants',
    interval: { type: 'everyNDays', n: 3 },
    keywords: ['podlewanie', 'doniczki'],
  },
  {
    id: 'water-balcony',
    name: 'Podlać balkon',
    category: 'plants',
    interval: { type: 'everyNDays', n: 2 },
    keywords: ['podlewanie', 'taras'],
  },
  {
    id: 'wash-windows',
    name: 'Umyć okna',
    category: 'home',
    interval: { type: 'monthly', day: 'first' },
    keywords: ['szyby', 'mycie'],
  },
  {
    id: 'hood-filter',
    name: 'Umyć filtr okapu',
    category: 'equipment',
    interval: { type: 'monthly', day: 'first' },
    keywords: ['okap', 'tłuszcz'],
  },
])

const search = (query, options) => searchChores(query, { catalog: CATALOG, ...options })
const ids = (query, options) => search(query, options).map((chore) => chore.id)

describe('fold', () => {
  it('strips Polish diacritics so a phone keyboard matches', () => {
    expect(fold('Podlać')).toBe('podlac')
    expect(fold('żółć')).toBe('zolc')
    expect(fold('Zamieść')).toBe('zamiesc')
  })

  it('handles ł, which NFD does not decompose', () => {
    expect(fold('Umyć podłogi')).toBe('umyc podlogi')
    expect(fold('ŁÓDŹ')).toBe('lodz')
  })

  it('collapses punctuation and whitespace to single spaces', () => {
    expect(fold('  Sprawdzić: czy nic  nie cieknie? ')).toBe('sprawdzic czy nic nie cieknie')
  })

  it('tokenizes an empty string to no tokens rather than one blank', () => {
    expect(tokenize('   ')).toEqual([])
  })
})

describe('searchChores', () => {
  it('matches a partial word by prefix', () => {
    expect(ids('podl').sort()).toEqual(['water-balcony', 'water-plants'])
  })

  it('matches through a keyword the name does not contain', () => {
    expect(ids('szyby')).toEqual(['wash-windows'])
    expect(ids('doniczki')).toEqual(['water-plants'])
  })

  it('ignores diacritics in the query', () => {
    expect(ids('podlac')).toContain('water-plants')
    expect(ids('tluszcz')).toEqual(['hood-filter'])
  })

  it('narrows on every extra token instead of widening', () => {
    expect(ids('umyc')).toHaveLength(2)
    expect(ids('umyc okna')).toEqual(['wash-windows'])
    expect(ids('umyc okna balkon')).toEqual([])
  })

  it('ranks an exact name hit above a prefix hit', () => {
    expect(ids('okna')[0]).toBe('wash-windows')
  })

  it('ranks a name hit above a keyword-only hit', () => {
    expect(ids('okap')[0]).toBe('hood-filter')
  })

  it('prefers the shorter name when scores tie', () => {
    expect(ids('podlewanie')).toEqual(['water-balcony', 'water-plants'])
  })

  it('returns nothing for a query below the minimum length', () => {
    expect(search('p')).toEqual([])
    expect(search('')).toEqual([])
    expect(search('   ')).toEqual([])
  })

  it('returns nothing when a token matches no entry', () => {
    expect(search('kajak')).toEqual([])
  })

  it('honours the limit', () => {
    expect(search('umyc', { limit: 1 })).toHaveLength(1)
  })

  it('searches the shipped catalog by default', () => {
    const hits = searchChores('smieci')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].name).toBe('Wynieść śmieci')
  })
})
