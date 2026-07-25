import { useEffect, useState } from 'react'
import { STORAGE_KEY } from '../lib/constants'

const DISMISSED_KEY = 'home-dashboard:legacy-import-dismissed:v1'

// One-time offer to upload tasks left over in this browser's localStorage from
// before the shared backend existed. No ongoing dual-write — once imported (or
// dismissed), this never reappears.
export function LegacyImportBanner({ tasks, isLoading, addTask, onImported }) {
  const [candidate, setCandidate] = useState(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (isLoading || tasks.length > 0) return
    if (window.localStorage.getItem(DISMISSED_KEY)) return
    let legacy
    try {
      legacy = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    } catch {
      return
    }
    if (Array.isArray(legacy) && legacy.length > 0) setCandidate(legacy)
  }, [isLoading, tasks.length])

  if (!candidate) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setCandidate(null)
  }

  const doImport = () => {
    setImporting(true)
    candidate.forEach((task) => addTask(task))
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.setItem(DISMISSED_KEY, '1')
    setCandidate(null)
    // Give the optimistic adds a moment to reach the server before refetching.
    setTimeout(() => onImported?.(), 500)
  }

  return (
    <div className="mb-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800 shadow dark:bg-blue-900/30 dark:text-blue-200">
      <p className="mb-2">
        Znaleziono {candidate.length} zadań zapisanych lokalnie w tej przeglądarce. Zaimportować
        je do wspólnej listy?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doImport}
          disabled={importing}
          className="rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? 'Importowanie…' : 'Importuj'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
        >
          Ignoruj
        </button>
      </div>
    </div>
  )
}
