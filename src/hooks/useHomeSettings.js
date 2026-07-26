import { useEffect, useState } from 'react'

// Household-wide settings from /api/home, with the server's own defaults as
// the answer while loading. Same shared-cache shape as useCategories: the
// dashboard needs the default rhythm for new tasks and the rhythm editor needs
// the week start, and neither should trigger its own fetch per mount.
export const DEFAULT_HOME_SETTINGS = {
  name: 'Nasz dom',
  weekStart: 1,
  defaultRhythm: 'weekly',
  remindMorning: true,
  remindOverdue: false,
}

let cache = null
let inflight = null
const listeners = new Set()

function notify() {
  for (const listener of listeners) listener(cache)
}

function fetchSettings() {
  // Same defensive start as useCategories — see the note there.
  inflight ??= Promise.resolve()
    .then(() => fetch('/api/home'))
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load settings'))))
    .then((data) => {
      cache = { ...DEFAULT_HOME_SETTINGS, ...data }
    })
    .catch(() => {
      cache = DEFAULT_HOME_SETTINGS
    })
    .then(() => {
      inflight = null
      notify()
    })
  return inflight
}

// Panel domu calls this after a successful PATCH.
export function invalidateHomeSettings() {
  cache = null
  fetchSettings()
}

export function useHomeSettings() {
  const [settings, setSettings] = useState(cache ?? DEFAULT_HOME_SETTINGS)

  useEffect(() => {
    const listener = (next) => setSettings(next ?? DEFAULT_HOME_SETTINGS)
    listeners.add(listener)
    if (cache) setSettings(cache)
    else fetchSettings()
    return () => listeners.delete(listener)
  }, [])

  return settings
}
