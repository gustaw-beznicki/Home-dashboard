export const STORAGE_KEY = 'home-dashboard:tasks:v1'
export const THEME_STORAGE_KEY = 'home-dashboard:theme'

export const CATEGORIES = [
  { key: 'plants', label: 'Rośliny' },
  { key: 'equipment', label: 'Sprzęt' },
  { key: 'home', label: 'Dom' },
  { key: 'health', label: 'Zdrowie' },
]

export const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
)

export const INTERVAL_TYPES = [
  { type: 'daily', label: 'Codziennie' },
  { type: 'everyNDays', label: 'Co N dni' },
  { type: 'weekly', label: 'Tygodniowo' },
  { type: 'monthly', label: 'Co miesiąc' },
  { type: 'manual', label: 'Ręcznie' },
]

export const PRIORITIES = [
  { key: 'low', label: 'Niski' },
  { key: 'medium', label: 'Średni' },
  { key: 'high', label: 'Wysoki' },
]

export const TABS = [
  { key: 'today', label: 'Dzisiaj' },
  { key: 'upcoming', label: 'Przybliżający się' },
  { key: 'all', label: 'Wszystko' },
  { key: 'archive', label: 'Archiwum' },
]

// Literal Tailwind class strings (not template-interpolated) so the JIT scanner picks them up.
export const STATUS_CLASS_MAP = {
  done: 'bg-green-500 text-white dark:bg-green-600',
  due: 'bg-yellow-400 text-gray-900 dark:bg-yellow-500',
  overdue: 'bg-red-500 text-white dark:bg-red-600',
  inactive: 'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
}

export const STATUS_LABELS = {
  done: 'Zrobione',
  due: 'Dzisiaj',
  overdue: 'Przeterminowane',
  inactive: 'Nieaktywne',
}
