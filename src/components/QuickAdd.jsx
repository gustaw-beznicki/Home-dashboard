import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { CategoryIcon } from './CategoryIcon'
import { COPY } from '../lib/constants'
import { useCategories } from '../hooks/useCategories'
import { describeInterval, toISODate } from '../lib/recurrence'

/**
 * Quick add. Typing a name and pressing Enter opens the sheet with that name
 * already filled in, so the rhythm — the part that actually needs a decision —
 * is confirmed rather than guessed.
 *
 * On top of that, the field suggests from a static catalog of ~200 common
 * household chores (ADR 0014): picking one prefills the category and a
 * suggested rhythm as well as the name. Free text still wins — Enter with no
 * suggestion highlighted behaves exactly as it always did, so the plain path
 * stays the default rather than an afterthought.
 *
 * Direction 3b would turn the same field into an AI input: one sentence in,
 * name + category + rhythm + anchor out. That needs a Worker-side model and a
 * key, so it is deliberately not wired up — see docs/runbooks/quickadd-ai-parse.md.
 * The catalog covers the chores people share; 3b would cover the odd ones.
 */
export function QuickAdd({ today, onDraft }) {
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [search, setSearch] = useState(null)
  const categories = useCategories()
  const blurTimer = useRef(null)
  const requested = useRef(false)

  // The catalog is ~8 kB gzipped — a tenth of the bundle, for a feature nobody
  // needs until they reach for the field. Loading it on first focus keeps it
  // off the path to first paint; Vite splits it into its own chunk, and the
  // browser caches it from then on.
  const loadCatalog = useCallback(() => {
    if (requested.current) return
    requested.current = true
    import('../lib/choreSearch').then((m) => setSearch(() => m.searchChores))
  }, [])

  const suggestions = useMemo(
    () => (open && search ? search(value) : []),
    [open, search, value]
  )

  // A stale highlight would make Enter pick a row that scrolled out of the
  // list two keystrokes ago.
  useEffect(() => setActive(-1), [value])

  useEffect(() => () => clearTimeout(blurTimer.current), [])

  const submit = () => {
    const name = value.trim()
    if (!name) return
    setValue('')
    setOpen(false)
    onDraft({ name })
  }

  const pick = (chore) => {
    // Categories are editable in Panel domu, so a catalog key can point at a
    // category this household deleted — 'home' is the same bucket the Worker
    // re-files orphaned tasks into.
    const known = categories.some((category) => category.key === chore.category)

    setValue('')
    setOpen(false)
    onDraft({
      name: chore.name,
      category: known ? chore.category : 'home',
      // The anchor is stamped here, never shipped in the catalog: an interval
      // means nothing without one (ADR 0010), and a canned date would be wrong
      // for everyone. RhythmEditor still shows it for confirmation.
      interval: { ...chore.interval, startsOn: toISODate(today) },
    })
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setActive((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setActive((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      if (suggestions[active]) pick(suggestions[active])
      else submit()
    } else if (e.key === 'Escape' && open) {
      // Closes the list without clearing the field: the text is still what the
      // user wants to add, they just don't want the suggestions.
      e.stopPropagation()
      setOpen(false)
    }
  }

  const expanded = open && suggestions.length > 0

  return (
    <div className="relative">
      {expanded && (
        <ul
          id="quick-add-suggestions"
          role="listbox"
          aria-label={COPY.suggestionsLabel}
          className="absolute bottom-[62px] left-0 right-[62px] z-10 max-h-[46vh] overflow-y-auto rounded-3xl bg-moss-50 py-2 shadow-pop dark:bg-bark-800"
        >
          {suggestions.map((chore, index) => (
            <li
              key={chore.id}
              id={`quick-add-suggestion-${chore.id}`}
              role="option"
              aria-selected={index === active}
              // onMouseDown, not onClick: the input's blur fires first and
              // would unmount the row before a click could land on it.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(chore)
              }}
              onMouseEnter={() => setActive(index)}
              className={[
                'flex cursor-pointer items-center gap-2.5 px-4.5 py-2.5 text-[14px]',
                index === active ? 'bg-moss-100 dark:bg-bark-700' : '',
              ].join(' ')}
            >
              <CategoryIcon
                category={chore.category}
                size={16}
                className="shrink-0 text-moss-600 dark:text-moss-500"
              />
              <span className="min-w-0 flex-1 truncate text-moss-900 dark:text-moss-100">
                {chore.name}
              </span>
              <span className="shrink-0 text-[12.5px] text-moss-500 dark:text-moss-600">
                {describeInterval(chore.interval)}
              </span>
            </li>
          ))}
          <li className="px-4.5 pb-1 pt-2 text-[12px] text-moss-500 dark:text-moss-600">
            {COPY.suggestionsHint}
          </li>
        </ul>
      )}

      <div className="flex items-center gap-2.5">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setOpen(true)
            loadCatalog()
          }}
          onFocus={() => {
            setOpen(true)
            loadCatalog()
          }}
          // Deferred so a mousedown on a row still resolves against a mounted
          // list; the pick handler closes it first anyway.
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={onKeyDown}
          placeholder={COPY.quickAddPlaceholder}
          aria-label={COPY.add}
          role="combobox"
          aria-expanded={expanded}
          aria-controls="quick-add-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={
            suggestions[active] ? `quick-add-suggestion-${suggestions[active].id}` : undefined
          }
          className="h-[54px] min-w-0 flex-1 rounded-full bg-moss-50 px-4.5 text-[14.5px] text-moss-900 shadow-card outline-hidden placeholder:text-moss-500 focus:ring-2 focus:ring-forest-500 dark:bg-bark-800 dark:text-moss-100"
        />
        <button
          type="button"
          aria-label={COPY.add}
          onClick={value.trim() ? submit : () => onDraft({})}
          className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-cta text-onaccent"
        >
          <Plus size={20} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
