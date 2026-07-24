import { CATEGORIES } from '../lib/constants'

export function CategoryFilter({ activeCategory, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
          activeCategory === null
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        Wszystkie
      </button>
      {CATEGORIES.map((cat) => (
        <button
          key={cat.key}
          type="button"
          onClick={() => onChange(cat.key)}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            activeCategory === cat.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  )
}
