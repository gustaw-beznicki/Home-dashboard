import { useEffect, useState } from 'react'
import { useTasks } from '../hooks/useTasks'
import { useDarkMode } from '../hooks/useDarkMode'
import { KpiBar } from './KpiBar'
import { TabBar } from './TabBar'
import { CategoryFilter } from './CategoryFilter'
import { TaskList } from './TaskList'
import { TaskForm } from './TaskForm'
import { DarkModeToggle } from './DarkModeToggle'
import { computeKpi, filterByCategory, filterForTab, sortByUrgency } from '../lib/taskLogic'

const TICK_INTERVAL_MS = 60_000

export function useNow() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => setNow(new Date())
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
  }, [])

  return now
}

export function Dashboard() {
  const { tasks, addTask, editTask, deleteTask, markDone, togglePin, archiveTask } = useTasks()
  const { isDark, toggle } = useDarkMode()
  const now = useNow()

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
      <header className="mb-4 flex items-center justify-between">
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

      <div className="mb-4">
        <KpiBar kpi={kpi} />
      </div>

      <div className="mb-4">
        <TabBar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mb-4">
        <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
      </div>

      <TaskList
        tasks={visibleTasks}
        today={now}
        onMarkDone={markDone}
        onEdit={(task) => setFormState({ mode: 'edit', task })}
        onDelete={deleteTask}
        onTogglePin={togglePin}
        onArchive={archiveTask}
      />

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
