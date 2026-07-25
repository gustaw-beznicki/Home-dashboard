import { useEffect, useState } from 'react'
import { UserButton } from '@clerk/react'
import { useTasks } from '../hooks/useTasks'
import { useDarkMode } from '../hooks/useDarkMode'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { KpiBar } from './KpiBar'
import { TabBar } from './TabBar'
import { CategoryFilter } from './CategoryFilter'
import { TaskList } from './TaskList'
import { TaskForm } from './TaskForm'
import { DarkModeToggle } from './DarkModeToggle'
import { LegacyImportBanner } from './LegacyImportBanner'
import { computeKpi, filterByCategory, filterForTab, sortByUrgency } from '../lib/taskLogic'

const TICK_INTERVAL_MS = 60_000

// Ticks on an interval, and on visibility/focus (mobile tabs get throttled/
// backgrounded, so re-checking on refocus catches a phone reopened after being
// locked overnight). `onTick` piggybacks a task refetch on the same triggers,
// so other people's changes show up without polling/websockets.
export function useNow(onTick) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => {
      setNow(new Date())
      onTick?.()
    }
    const interval = setInterval(tick, TICK_INTERVAL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', tick)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return now
}

export function Dashboard() {
  const {
    tasks,
    isLoading,
    error,
    retry,
    addTask,
    editTask,
    deleteTask,
    markDone,
    togglePin,
    archiveTask,
  } = useTasks()
  const { isDark, toggle } = useDarkMode()
  const { user } = useCurrentUser()
  const now = useNow(retry)

  const [activeTab, setActiveTab] = useState('today')
  const [activeCategory, setActiveCategory] = useState(null)
  const [formState, setFormState] = useState(null) // null | { mode: 'add' } | { mode: 'edit', task }

  const byTab = filterForTab(tasks, activeTab, now)
  const byCategory = filterByCategory(byTab, activeCategory)
  const visibleTasks = sortByUrgency(byCategory, now)
  const kpi = computeKpi(tasks, now)

  const handleSubmit = (draft) => {
    if (formState?.mode === 'edit') {
      editTask(formState.task.id, draft)
    } else {
      addTask(draft)
    }
    setFormState(null)
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-gray-50 px-4 py-4 dark:bg-gray-900">
      <header className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">🏠 Home Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFormState({ mode: 'add' })}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Dodaj zadanie
          </button>
          <DarkModeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </header>

      <div className="mb-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{user ? `Zalogowano jako: ${user.name || user.email}` : ''}</span>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <a href="/admin" className="underline">
              Panel administracyjny
            </a>
          )}
          <UserButton />
        </div>
      </div>

      <LegacyImportBanner
        tasks={tasks}
        isLoading={isLoading}
        addTask={addTask}
        onImported={retry}
      />

      <div className="mb-4">
        <KpiBar kpi={kpi} />
      </div>

      <div className="mb-4">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mb-4">
        <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
      </div>

      {isLoading && tasks.length === 0 && !error && (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
          Ładowanie zadań…
        </p>
      )}

      {error && tasks.length === 0 && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow dark:bg-red-900/30 dark:text-red-300">
          Nie udało się wczytać zadań.{' '}
          <button type="button" onClick={retry} className="font-medium underline">
            Spróbuj ponownie
          </button>
        </div>
      )}

      {error && tasks.length > 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800 shadow dark:bg-yellow-900/30 dark:text-yellow-200">
          Nie udało się zapisać ostatniej zmiany. Spróbuj ponownie.
        </div>
      )}

      {(!isLoading || tasks.length > 0) && (
        <TaskList
          tasks={visibleTasks}
          today={now}
          onMarkDone={markDone}
          onEdit={(task) => setFormState({ mode: 'edit', task })}
          onDelete={deleteTask}
          onTogglePin={togglePin}
          onArchive={archiveTask}
        />
      )}

      {formState && (
        <TaskForm
          mode={formState.mode}
          task={formState.task}
          onSubmit={handleSubmit}
          onCancel={() => setFormState(null)}
        />
      )}
    </div>
  )
}
