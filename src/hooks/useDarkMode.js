import { useEffect, useState } from 'react'
import { THEME_STORAGE_KEY } from '../lib/constants'

function getInitialDarkMode() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark') return true
    if (stored === 'light') return false
  } catch {
    // ignore, fall through to system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(getInitialDarkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light')
    } catch {
      // ignore persistence failure
    }
  }, [isDark])

  const toggle = () => setIsDark((prev) => !prev)

  return { isDark, toggle }
}
