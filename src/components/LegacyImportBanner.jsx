import { useEffect, useState } from 'react'
import { COPY, STORAGE_KEY } from '../lib/constants'

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
    <div className="mb-4.5 rounded-hero bg-moss-200 p-4.5 dark:bg-bark-800">
      <p className="mb-3 text-[13.5px] leading-relaxed text-moss-800 dark:text-moss-300">
        {COPY.importBanner.text(candidate.length)}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doImport}
          disabled={importing}
          className="h-[46px] rounded-full bg-cta px-5 text-[14px] font-medium text-onaccent disabled:opacity-50"
        >
          {importing ? COPY.importBanner.working : COPY.importBanner.confirm}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="h-[46px] rounded-full bg-moss-50 px-5 text-[14px] text-moss-700 dark:bg-bark-700 dark:text-moss-400"
        >
          {COPY.importBanner.dismiss}
        </button>
      </div>
    </div>
  )
}
