import { CATEGORIES, COPY } from '../lib/constants'

// The category filter survived the tab cull, but as chips sitting next to the
// list filter rather than in a bar of their own — the two compose, and now you
// can see that they do.
export function CategoryFilter({ activeCategory, onChange }) {
  const chips = [{ key: null, label: COPY.allCategories }, ...CATEGORIES]

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const active = activeCategory === chip.key
        return (
          <button
            key={chip.key ?? 'all'}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.key)}
            className={[
              'rounded-full px-3 py-1.5 text-[12.5px] transition',
              active
                ? 'bg-forest-600 font-medium text-moss-100'
                : 'bg-moss-200 text-moss-700 hover:bg-moss-300 dark:bg-bark-700 dark:text-moss-400',
            ].join(' ')}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
