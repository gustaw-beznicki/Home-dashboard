import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { STORAGE_KEY } from '../lib/constants'
import { toISODate } from '../lib/taskLogic'

export function useTasks() {
  const [tasks, setTasks] = useLocalStorage(STORAGE_KEY, [])

  const addTask = useCallback(
    (draft) => {
      const task = {
        id: crypto.randomUUID(),
        name: draft.name,
        lastDone: null,
        interval: draft.interval,
        priority: draft.priority ?? 'medium',
        note: draft.note ?? '',
        category: draft.category,
        pinned: false,
        archived: false,
      }
      setTasks((prev) => [...prev, task])
      return task
    },
    [setTasks]
  )

  const editTask = useCallback(
    (id, patch) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    },
    [setTasks]
  )

  const deleteTask = useCallback(
    (id) => {
      setTasks((prev) => prev.filter((t) => t.id !== id))
    },
    [setTasks]
  )

  const markDone = useCallback(
    (id, today = new Date()) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, lastDone: toISODate(today) } : t))
      )
    },
    [setTasks]
  )

  const togglePin = useCallback(
    (id) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)))
    },
    [setTasks]
  )

  const archiveTask = useCallback(
    (id, archived = true) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, archived } : t)))
    },
    [setTasks]
  )

  return { tasks, addTask, editTask, deleteTask, markDone, togglePin, archiveTask }
}
