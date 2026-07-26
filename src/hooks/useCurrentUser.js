import { useEffect, useState } from 'react'

// Who am I, from /api/whoami — same shared-cache shape as useHomeSettings, so
// App (which gates onboarding on `onboardedAt`) and Sidebar don't each fire
// their own request per mount.
let cache
let inflight = null
const listeners = new Set()

function notify() {
  for (const listener of listeners) listener(cache)
}

function fetchUser() {
  inflight ??= Promise.resolve()
    .then(() => fetch('/api/whoami'))
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then((data) => {
      cache = data
      inflight = null
      notify()
    })
  return inflight
}

// Onboarding just PATCHed /api/me — push the fresh row into the cache so every
// mounted consumer (the sidebar's name and avatar) updates without a refetch.
export function updateCachedUser(user) {
  cache = user
  notify()
}

export function useCurrentUser() {
  const [user, setUser] = useState(cache ?? null)
  const [isLoading, setIsLoading] = useState(cache === undefined)

  useEffect(() => {
    const listener = (next) => {
      setUser(next)
      setIsLoading(false)
    }
    listeners.add(listener)
    if (cache === undefined) fetchUser()
    else listener(cache)
    return () => listeners.delete(listener)
  }, [])

  return { user, isLoading }
}
