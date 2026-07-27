// Matching for the quick-add suggestion list. Pure, clockless and DOM-free,
// same rule as recurrence.js — the whole thing is a function of (query,
// catalog), so it is testable without a render or a fake timer.
//
// The catalog is ~200 static entries shipped in the bundle, so there is no
// index to build and no server to ask: a linear pass over a few hundred
// pre-tokenised strings is microseconds, and it runs on every keystroke with
// no network hop. See ADR 0014.
//
// The hard part here is Polish, not the search. "podlewanie", "podlać" and
// "podlej" share no usable prefix, and phones type "podlac" without the
// diacritic. Neither is solved by a cleverer tokenizer — they are solved by
// `keywords` on each entry (data) and by folding both sides (below).

import { CHORE_CATALOG } from './choreCatalog'

/**
 * Lowercase, strip diacritics, collapse everything else to spaces.
 *
 * NFD decomposes ą/ć/ę/ń/ó/ś/ź/ż into a base letter plus a combining mark we
 * can drop — but not ł, which is its own codepoint with no decomposition, so
 * it gets replaced explicitly.
 */
export function fold(text) {
  return String(text)
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokenize(text) {
  const folded = fold(text)
  return folded ? folded.split(' ') : []
}

// Shortest query that opens the list. One letter matches most of the catalog,
// which is a wall of suggestions rather than a suggestion.
export const MIN_QUERY_LENGTH = 2

// Built once at module load: every entry's name tokens and keyword tokens,
// folded. Keeping the two apart is what lets a name hit outrank a keyword hit.
function indexEntry(entry) {
  return {
    entry,
    nameTokens: tokenize(entry.name),
    keywordTokens: entry.keywords.flatMap((keyword) => tokenize(keyword)),
  }
}

const INDEX = CHORE_CATALOG.map(indexEntry)

// Weights. Exact beats prefix so "mop" ranks "Umyć podłogi mopem" above
// "Mopowanie tarasu", and a hit in the visible name beats one in an invisible
// alias so the list doesn't look arbitrary.
const NAME_EXACT = 10
const NAME_PREFIX = 6
const KEYWORD_EXACT = 4
const KEYWORD_PREFIX = 2

function scoreToken(queryToken, indexed) {
  let best = 0

  indexed.nameTokens.forEach((token, position) => {
    if (token === queryToken) best = Math.max(best, NAME_EXACT - position * 0.1)
    else if (token.startsWith(queryToken)) best = Math.max(best, NAME_PREFIX - position * 0.1)
  })

  for (const token of indexed.keywordTokens) {
    if (token === queryToken) best = Math.max(best, KEYWORD_EXACT)
    else if (token.startsWith(queryToken)) best = Math.max(best, KEYWORD_PREFIX)
  }

  return best
}

/**
 * Entries matching `query`, best first.
 *
 * Every query token has to match something (AND, not OR): typing more words
 * has to narrow the list, otherwise "umyć okna" would rank every chore
 * containing "umyć". A token matches by prefix, so partial words work while
 * someone is still typing.
 */
export function searchChores(query, { limit = 6, catalog = INDEX } = {}) {
  const queryTokens = tokenize(query)
  if (!queryTokens.length || fold(query).length < MIN_QUERY_LENGTH) return []

  const hits = []

  for (const indexed of catalog) {
    let total = 0
    for (const queryToken of queryTokens) {
      const score = scoreToken(queryToken, indexed)
      if (!score) {
        total = 0
        break
      }
      total += score
    }
    if (total > 0) hits.push({ indexed, score: total })
  }

  hits.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    const length = a.indexed.entry.name.length - b.indexed.entry.name.length
    if (length !== 0) return length
    return a.indexed.entry.name.localeCompare(b.indexed.entry.name, 'pl')
  })

  return hits.slice(0, limit).map((hit) => hit.indexed.entry)
}

/** Test seam: search an ad-hoc catalog without touching the shipped one. */
export function buildIndex(entries) {
  return entries.map(indexEntry)
}
