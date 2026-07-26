import { useEffect, useState } from 'react'

/**
 * "11 rzeczy ogarniętych w tym tygodniu, Anna 6 · Kuba 5" can't be derived from
 * `/api/tasks`: `lastDone` only remembers the newest completion, so a task done
 * three times in a week would count once. The real answer lives in the
 * append-only `completions` table, hence a separate endpoint.
 *
 * Refetched whenever the task list changes, which covers both ticking something
 * off and the periodic refetch that picks up the other person's taps.
 */
export function useWeekStats(tasks) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats/week')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data)
      })
      .catch(() => {
        // A missing week summary is not worth surfacing — the card just hides.
      })
    return () => {
      cancelled = true
    }
  }, [tasks])

  return stats
}
