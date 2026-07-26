import { Moon, Sun } from 'lucide-react'

// Zero emoji anywhere in the UI — icons only where they mean something.
export function DarkModeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Przełącz motyw"
      className="grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-moss-200 text-moss-700 hover:bg-moss-300 dark:bg-bark-700 dark:text-moss-400"
    >
      {isDark ? <Sun size={17} strokeWidth={1.8} /> : <Moon size={17} strokeWidth={1.8} />}
    </button>
  )
}
