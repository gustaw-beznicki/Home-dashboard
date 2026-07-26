import { useCallback, useEffect, useState } from 'react'
import { toISODate } from '../lib/recurrence'

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const ROLLBACK_FLASH_MS = 1200

async function assertOk(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  // The card that snapped back after a failed write, so the list can pulse it
  // once rather than silently pretending nothing happened.
  const [rolledBackId, setRolledBackId] = useState(null)

  const fetchTasks = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks')
      setTasks(await assertOk(res))
    } catch (e) {
      setError(e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const flagRollback = useCallback((id) => {
    setRolledBackId(id)
    setTimeout(() => setRolledBackId((current) => (current === id ? null : current)), ROLLBACK_FLASH_MS)
  }, [])

  // Applies `updater` to local state immediately (optimistic), fires the API
  // call, and either merges the server response via `onSuccess` or rolls the
  // local state back on failure. A household app should feel instant even on
  // flaky mobile data — an occasional visible rollback is a smaller cost than
  // every tap waiting on a round trip.
  const mutate = useCallback(
    (id, updater, apiCall, onSuccess) => {
      let previous
      setTasks((prev) => {
        previous = prev
        return updater(prev)
      })
      apiCall()
        .then((result) => {
          if (onSuccess) setTasks((prev) => onSuccess(prev, result))
        })
        .catch((e) => {
          setTasks(previous)
          setError(e)
          if (id) flagRollback(id)
        })
    },
    [flagRollback]
  )

  const addTask = useCallback((draft) => {
    const tempId = crypto.randomUUID()
    const task = {
      id: tempId,
      lastDone: null,
      pinned: false,
      archived: false,
      note: '',
      completedBy: null,
      ...draft,
    }
    setTasks((prev) => [...prev, task])
    fetch('/api/tasks', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) })
      .then(assertOk)
      .then((saved) => setTasks((prev) => prev.map((t) => (t.id === tempId ? saved : t))))
      .catch((e) => {
        setTasks((prev) => prev.filter((t) => t.id !== tempId))
        setError(e)
      })
    return task
  }, [])

  const editTask = useCallback(
    (id, patch) => {
      mutate(
        id,
        (prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        () =>
          fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify(patch),
          }).then(assertOk),
        (prev, saved) => prev.map((t) => (t.id === id ? saved : t))
      )
    },
    [mutate]
  )

  const deleteTask = useCallback(
    (id) => {
      mutate(
        id,
        (prev) => prev.filter((t) => t.id !== id),
        () => fetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(assertOk)
      )
    },
    [mutate]
  )

  const markDone = useCallback(
    (id, today = new Date()) => {
      const iso = toISODate(today)
      mutate(
        id,
        (prev) => prev.map((t) => (t.id === id ? { ...t, lastDone: iso } : t)),
        () =>
          fetch(`/api/tasks/${id}/complete`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ date: iso }),
          }).then(assertOk),
        (prev, saved) => prev.map((t) => (t.id === id ? saved : t))
      )
    },
    [mutate]
  )

  // Undo drops the completion row too, not just the denormalized cache on
  // `tasks` — `completions` is the history of who did what, and a tap taken
  // back within seconds was never part of that history. The server recomputes
  // last_done from whatever rows remain.
  const undoDone = useCallback(
    (id) => {
      mutate(
        id,
        (prev) => prev.map((t) => (t.id === id ? { ...t, lastDone: null } : t)),
        () => fetch(`/api/tasks/${id}/complete`, { method: 'DELETE' }).then(assertOk),
        (prev, saved) => prev.map((t) => (t.id === id ? saved : t))
      )
    },
    [mutate]
  )

  const togglePin = useCallback(
    (id) => {
      const current = tasks.find((t) => t.id === id)
      mutate(
        id,
        (prev) => prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)),
        () =>
          fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ pinned: !current?.pinned }),
          }).then(assertOk)
      )
    },
    [mutate, tasks]
  )

  const archiveTask = useCallback(
    (id, archived = true) => {
      mutate(
        id,
        (prev) => prev.map((t) => (t.id === id ? { ...t, archived } : t)),
        () =>
          fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ archived }),
          }).then(assertOk)
      )
    },
    [mutate]
  )

  return {
    tasks,
    isLoading,
    error,
    rolledBackId,
    retry: fetchTasks,
    addTask,
    editTask,
    deleteTask,
    markDone,
    undoDone,
    togglePin,
    archiveTask,
  }
}
