import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { TaskCard } from './TaskCard'
import { COPY, STATUS_MARK_CLASS } from '../lib/constants'

/**
 * Everything ticked off today, kept on the list until the day turns over.
 *
 * This is not the same affordance as the sticky groups. Those hold a completion
 * *in place* for the few seconds of the undo window, so the list does not
 * reshuffle under the thumb that just tapped it. When that window closes the
 * completion used to leave the page altogether — and then the hero read "4 z 4"
 * above a list saying "Na dziś nic", with no way to see what had been done or to
 * take any of it back. Reloading the app made the whole day's work invisible.
 *
 * So a completion settles here instead of vanishing, and "cofnij" keeps working
 * for the rest of the day. Collapsed, it is one line: the default state of this
 * app is still meant to look like nothing is pending.
 */
export function DoneToday({ tasks, today, onUndo, onOpen }) {
  const [open, setOpen] = useState(true)
  if (!tasks.length) return null

  return (
    <section className="mt-5.5">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        className="mb-2.5 flex w-full items-center gap-2.5 px-1 text-left"
      >
        <span className={STATUS_MARK_CLASS.done} />
        <h2 className="text-[15px] font-medium text-moss-800 dark:text-moss-300">
          {COPY.doneTodayTitle}
        </h2>
        <span className="text-[13px] text-moss-500 dark:text-moss-600">{tasks.length}</span>
        <span className="ml-auto text-moss-500 dark:text-moss-600">
          {open ? <ChevronUp size={16} strokeWidth={2} /> : <ChevronDown size={16} strokeWidth={2} />}
        </span>
      </button>

      {open ? (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              today={today}
              onDone={() => {}}
              onUndo={onUndo}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <p className="px-1 text-[12.5px] text-moss-600 dark:text-moss-500">
          {COPY.doneTodayCollapsed}
        </p>
      )}
    </section>
  )
}
