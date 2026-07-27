# Suggest chores from a static bundled catalog, not a search service

## Status

Accepted

## Context

Quick-add is a bare text field: you type a name, press Enter, and confirm the rhythm in the task
sheet. The name is the easy half. The rhythm is the part that needs an actual decision, and every
household re-invents "how often should the hood filter be washed?" from nothing.

Design direction 3b answers this with an AI parse endpoint — one sentence in, name + category +
rhythm + anchor out (`docs/runbooks/quickadd-ai-parse.md`). That answer is real but expensive in the
non-monetary sense: an Anthropic key, a spend limit, a request cap, and an outbound dependency in an
app whose only current ones are Google and Resend.

Most household chores, though, are not novel. A few hundred of them cover what people actually add,
and each has a defensible default rhythm. That is a lookup problem, not a language problem.

The obvious shape for a lookup problem is a search index — a tokenized store (Elasticsearch or
similar), or an FTS index in D1 behind a `GET /api/chores/search`. Two facts make that the wrong
instinct here:

- The catalog is **identical for every household**. Nothing about it is per-user, per-tenant or
  mutable at runtime. That makes it build-time data, not database data.
- It is **~200 entries, ~8 kB gzipped**. A server round trip per keystroke, a migration, a seed
  script, Worker CPU against the Free-plan 10 ms startup budget, and a cache-invalidation story —
  all to search something smaller than one icon font.

The genuinely hard part turned out to be Polish morphology, not retrieval: "podlewanie" / "podlać" /
"podlej" share no usable prefix, and phones type "podlac" without the diacritic. No off-the-shelf
tokenizer fixes that without a stemmer dependency.

## Decision

Ship the catalog as a static JavaScript module (`src/lib/choreCatalog.js`, ~194 entries across the
four built-in categories) and match it in the browser (`src/lib/choreSearch.js`). No table, no
endpoint, no index to keep warm.

- **Matching is a pure function.** `fold()` lowercases and strips diacritics (including `ł`, which
  NFD does not decompose); every query token must prefix-match some entry token (AND, not OR), so
  typing more narrows rather than widens. Scores rank exact over prefix and name over alias.
- **Morphology lives in the data.** Each entry carries 2–5 `keywords` — the inflected forms people
  actually type. No stemmer.
- **Entries never carry an anchor.** `interval` ships without `startsOn`; the anchor is stamped from
  today at pick time. A canned date would be wrong for every household, and an interval without an
  anchor is meaningless (ADR 0010). `RhythmEditor` still shows rhythm and anchor for confirmation —
  a suggestion fills the form, it never skips the confirm.
- **The catalog is code-split.** `QuickAdd` imports `choreSearch` dynamically on first focus, so the
  7.3 kB chunk stays off the path to first paint and is cached from then on. The main bundle grows
  by 1.3 kB gzipped (the combobox itself).
- **Free text still wins.** Enter with no suggestion highlighted behaves exactly as it did before.
  The plain path is the default, not a fallback.
- **This does not replace direction 3b.** The catalog covers the chores households share; the AI
  parse would cover free-form sentences with odd rhythms ("co drugą sobotę miesiąca"). The runbook
  stays live and unchanged.

## Consequences

Adding a known chore is now two keystrokes and a tap, with a category and a defensible rhythm
already filled in — and it costs nothing per use, works offline, and cannot hallucinate a rhythm.

The catalog is a maintenance surface: ~194 hand-written rows in Polish, whose rhythms are opinions.
`src/lib/choreCatalog.test.js` enforces the invariants the rest of the app assumes (unique ids,
known category keys, valid rhythm shapes, no `startsOn`, at least two distinct keywords, and that
every entry anchored on today lands in "Na dziś" rather than somewhere invisible), so a typo fails
CI instead of shipping as a chore that never comes due. Recall gaps, though, are invisible: a chore
nobody wrote down simply does not suggest, with no signal that it was missed.

Catalog `category` keys are the four built-ins, but households can rename or delete categories
(ADR 0013). `QuickAdd` checks the picked key against the live list and falls back to `home` — the
same bucket the Worker re-files orphaned tasks into.

Growth has a ceiling. At ~1000 entries the chunk approaches 40 kB gzipped and a linear scan per
keystroke starts to matter; that is the point to reconsider an index, not before.

Nothing here is per-household, so nothing here can learn. A household that renames "Wynieść śmieci"
to "Kubeł" gets no benefit from having done so — suggestions stay generic by construction.
