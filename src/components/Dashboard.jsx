import { useCallback, useEffect, useMemo, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { signOut } from '../lib/authClient'
import { useTasks } from '../hooks/useTasks'
import { useDarkMode } from '../hooks/useDarkMode'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useWeekStats } from '../hooks/useWeekStats'
import { Sidebar } from './Sidebar'
import { HeroCard } from './HeroCard'
import { TaskList } from './TaskList'
import { TaskSheet } from './TaskSheet'
import { QuickAdd } from './QuickAdd'
import { EmptyState } from './EmptyState'
import { DayComplete } from './DayComplete'
import { RollbackBanner } from './RollbackBanner'
import { CategoryFilter } from './CategoryFilter'
import { DarkModeToggle } from './DarkModeToggle'
import { LegacyImportBanner } from './LegacyImportBanner'
import { COPY, GROUPS, UNDO_WINDOW_MS, VIEWS } from '../lib/constants'
import {
  computeStatus,
  dayClosed,
  dayProgress,
  filterByCategory,
  filterForView,
  groupTasks,
} from '../lib/recurrence'
import { formatDate, weekdayName } from '../lib/plural'

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

/**
 * A task ticked off keeps its place in the group it was ticked off in, greyed
 * out, with an "cofnij" affordance — the list must not reshuffle under the
 * thumb that just tapped it. After the undo window closes the task drops out of
 * the list entirely; it is done, and the default state of this app is meant to
 * look like nothing is pending.
 */
function useUndoWindow() {
  const [sticky, setSticky] = useState(() => new Map())

  const remember = useCallback((id, group) => {
    setSticky((prev) => new Map(prev).set(id, group))
    setTimeout(() => {
      setSticky((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }, UNDO_WINDOW_MS)
  }, [])

  const forget = useCallback((id) => {
    setSticky((prev) => {
      if (!prev.has(id)) return prev
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  return { sticky, remember, forget }
}

export function Dashboard() {
  const {
    tasks,
    isLoading,
    error,
    rolledBackId,
    rollback,
    retry,
    addTask,
    editTask,
    deleteTask,
    markDone,
    undoDone,
    togglePin,
    archiveTask,
  } = useTasks()
  const { isDark, toggle } = useDarkMode()
  const { user } = useCurrentUser()
  const now = useNow(retry)
  const weekStats = useWeekStats(tasks)
  const { sticky, remember, forget } = useUndoWindow()

  const [activeView, setActiveView] = useState('all')
  const [activeCategory, setActiveCategory] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sheet, setSheet] = useState(null) // null | { task } | { draft }

  const viewCounts = useMemo(
    () =>
      Object.fromEntries(VIEWS.map((view) => [view.key, filterForView(tasks, view.key, now).length])),
    [tasks, now]
  )

  const sections = useMemo(() => {
    const inView = filterByCategory(filterForView(tasks, activeView, now), activeCategory)

    // The Schowek is a flat list: urgency stops mean nothing for things that
    // have deliberately been put away.
    if (activeView === 'archive') {
      const label = VIEWS.find((view) => view.key === 'archive').label
      return [{ key: 'archive', label, mark: 'later', tasks: inView }]
    }

    // A completed task is only still on the list while its undo window is open.
    const visible = inView.filter(
      (task) => computeStatus(task, now) !== 'done' || sticky.has(task.id)
    )
    const groups = groupTasks(visible, now, sticky)
    return GROUPS.map((group) => ({ ...group, mark: group.key, tasks: groups[group.key] }))
  }, [tasks, activeView, activeCategory, now, sticky])

  const isEmpty = sections.every((section) => section.tasks.length === 0)

  // The sticky map remembers which stop each thing was ticked off in, which is
  // what lets a "na spokojnie" thing ticked off early stay out of today's load —
  // count it and the denominator would grow under the thumb that just tapped it,
  // sending the percentage backwards.
  const progress = useMemo(
    () => dayProgress(tasks, now, (task) => sticky.get(task.id) === 'later'),
    [tasks, now, sticky]
  )

  const dayComplete = dayClosed(
    progress,
    sections.flatMap((section) => section.tasks),
    now
  )

  // "Na dziś nic. Dom się sam ogarnął." is only true of the unfiltered list —
  // a filter that happens to match nothing is a different, duller message.
  const emptyVariant =
    tasks.length === 0
      ? 'all'
      : !activeCategory && (activeView === 'all' || activeView === 'today')
        ? 'today'
        : 'view'

  const handleDone = (task) => {
    const status = computeStatus(task, now)
    remember(task.id, status === 'done' ? 'due' : status)
    markDone(task.id, now)
    setSheet(null)
  }

  const handleUndo = (task) => {
    forget(task.id)
    undoDone(task.id)
  }

  const handleSave = (draft) => {
    if (sheet?.task) editTask(sheet.task.id, draft)
    else addTask(draft)
    setSheet(null)
  }

  return (
    <div className="flex min-h-screen bg-moss-100 dark:bg-bark-900">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        counts={viewCounts}
        user={user}
        onSignOut={() => signOut().then(() => window.location.reload())}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-3xl flex-1 px-4.5 pb-32 pt-5 lg:max-w-none lg:px-6 lg:pb-6">
          <header className="mb-4.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-medium text-moss-900 dark:text-moss-100">
                Cześć{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
              </p>
              <p className="text-[12.5px] text-moss-600 dark:text-moss-500">
                {weekdayName(now)}, {formatDate(now)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                aria-label="Filtry"
                className="grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-moss-200 text-moss-700 hover:bg-moss-300 lg:hidden dark:bg-bark-700 dark:text-moss-400"
              >
                <SlidersHorizontal size={17} strokeWidth={1.8} />
              </button>
              <DarkModeToggle isDark={isDark} onToggle={toggle} />
              {user?.role === 'admin' && (
                <a
                  href="/admin"
                  aria-label={COPY.admin.title}
                  className="grid h-[38px] w-[38px] place-items-center rounded-[14px] bg-cta text-[13px] font-medium text-onaccent lg:hidden"
                >
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </a>
              )}
            </div>
          </header>

          {filtersOpen && (
            <div className="mb-4.5 animate-riseIn space-y-3 rounded-hero bg-moss-200 p-4 lg:hidden dark:bg-bark-800">
              <div className="flex flex-wrap gap-1.5">
                {VIEWS.map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    aria-pressed={activeView === view.key}
                    onClick={() => setActiveView(view.key)}
                    className={[
                      'rounded-full px-3 py-1.5 text-[12.5px] transition',
                      activeView === view.key
                        ? 'bg-forest-600 font-medium text-onaccent'
                        : 'bg-moss-50 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                    ].join(' ')}
                  >
                    {view.label}
                    <span className="ml-1.5 text-moss-500">{viewCounts[view.key]}</span>
                  </button>
                ))}
              </div>
              <CategoryFilter activeCategory={activeCategory} onChange={setActiveCategory} />
              <button
                type="button"
                onClick={() => signOut().then(() => window.location.reload())}
                className="text-[12.5px] text-moss-600 underline underline-offset-2 dark:text-moss-500"
              >
                {COPY.signOut}
              </button>
            </div>
          )}

          <div className="mb-5.5">
            <HeroCard tasks={tasks} today={now} weekStats={weekStats} progress={progress} />
          </div>

          <LegacyImportBanner
            tasks={tasks}
            isLoading={isLoading}
            addTask={addTask}
            onImported={retry}
          />

          {rollback ? (
            <RollbackBanner name={rollback.name} onRetry={rollback.retry} />
          ) : (
            // Writes that never went through `mutate` — adding a thing — have no
            // single card to name or re-fire, so they keep the flat line.
            error &&
            tasks.length > 0 && (
              <p className="mb-4 rounded-2xl bg-amber-100 px-4 py-3 text-[13px] text-amber-500 dark:bg-[#3e3a29]">
                {COPY.rollback}
              </p>
            )
          )}

          {isLoading && tasks.length === 0 && !error && (
            <p className="rounded-hero bg-moss-200 px-6 py-10 text-center text-[15px] text-moss-600 dark:bg-bark-700 dark:text-moss-500">
              {COPY.loading}
            </p>
          )}

          {error && tasks.length === 0 && (
            <div className="rounded-hero bg-moss-50 px-6 py-8 text-center shadow-card dark:bg-bark-800">
              <p className="mb-3 text-[15px] text-clay-500">{COPY.loadError}</p>
              <button
                type="button"
                onClick={retry}
                className="h-[46px] rounded-full bg-cta px-5 text-[14px] font-medium text-onaccent"
              >
                {COPY.retry}
              </button>
            </div>
          )}

          {!isLoading && !error && isEmpty && (
            <EmptyState tasks={tasks} today={now} variant={emptyVariant} />
          )}

          {dayComplete && (
            <div className="mb-5.5">
              <DayComplete
                count={progress.done}
                playKey={progress.done}
                onAction={() => setActiveView('upcoming')}
              />
            </div>
          )}

          {!isEmpty && (
            <TaskList
              sections={sections}
              today={now}
              onDone={handleDone}
              onUndo={handleUndo}
              onOpen={(task) => setSheet({ task })}
              rolledBackId={rolledBackId}
            />
          )}
        </main>

        {/* Fixed on a phone so adding is always a thumb away; in flow on a
            desktop, where the sheet occupies the right-hand side instead. */}
        <div className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-moss-100 via-moss-100 to-transparent px-4.5 pb-4.5 pt-6 lg:static lg:mx-auto lg:w-full lg:max-w-3xl lg:bg-none lg:px-6 lg:pb-6 lg:pt-0 dark:from-bark-900 dark:via-bark-900">
          <QuickAdd today={now} onDraft={(draft) => setSheet({ draft })} />
        </div>
      </div>

      {sheet && (
        <TaskSheet
          task={sheet.task}
          draft={sheet.draft}
          today={now}
          onSave={handleSave}
          onClose={() => setSheet(null)}
          onDone={handleDone}
          onDelete={(task) => {
            deleteTask(task.id)
            setSheet(null)
          }}
          onArchive={(task) => {
            archiveTask(task.id, !task.archived)
            setSheet(null)
          }}
          onTogglePin={(task) => {
            togglePin(task.id)
            setSheet(null)
          }}
        />
      )}
    </div>
  )
}
