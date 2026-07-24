export function DarkModeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Przełącz motyw"
      className="rounded-full p-2 text-xl hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
