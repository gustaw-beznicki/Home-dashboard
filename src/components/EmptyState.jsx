import { Check } from 'lucide-react'
import { COPY } from '../lib/constants'
import { relativeDue } from '../lib/plural'
import { daysUntilDue, sortByUrgency } from '../lib/recurrence'

/**
 * "Nothing today" is the ordinary state, not an error state — it should read as
 * a reward rather than a hole. So instead of an empty box we show what is
 * coming next.
 */
export function EmptyState({ tasks, today, variant = 'today' }) {
  if (variant === 'all') {
    return (
      <div className="rounded-hero bg-moss-200 px-6 py-12 text-center dark:bg-bark-700">
        <p className="mx-auto max-w-[22ch] text-[22px] leading-snug text-moss-900 dark:text-moss-100">
          {COPY.emptyAll}
        </p>
      </div>
    )
  }

  if (variant === 'view') {
    return (
      <div className="rounded-hero bg-moss-200 px-6 py-10 text-center dark:bg-bark-700">
        <p className="text-[17px] text-moss-700 dark:text-moss-400">{COPY.emptyView}</p>
      </div>
    )
  }

  const next = sortByUrgency(
    tasks.filter((t) => !t.archived),
    today
  )[0]
  const until = next ? daysUntilDue(next, today) : null

  return (
    <div className="rounded-hero bg-forest-600 px-6 py-12 text-center text-moss-100">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#456b50]">
        <Check size={26} strokeWidth={2.4} className="text-lime-400" />
      </div>
      <p className="mx-auto max-w-[20ch] text-[24px] leading-snug">{COPY.emptyToday}</p>
      {next && until !== null && (
        <p className="mt-3 text-[13.5px] text-[#a9c9a5]">
          {COPY.emptyTodayHint} {relativeDue(until)}: {next.name}
        </p>
      )}
    </div>
  )
}
