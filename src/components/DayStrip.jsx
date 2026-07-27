import { dayLoad } from '../lib/recurrence'
import { countWith, FORMS, formatDate } from '../lib/plural'

const WEEKDAY_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb']

/**
 * The house has a pulse: bar height is how much falls due that day, colour is
 * today / arrears / later. Sits inside the dark hero card. The first bar is
 * yesterday, which is where overdue work piles up.
 */
export function DayStrip({ tasks, today, days = 12, onSelectDay }) {
  const load = dayLoad(tasks, today, days)
  const max = Math.max(1, ...load.map((d) => d.count))

  return (
    <div className="flex h-[62px] items-end gap-1.5 sm:h-[78px]">
      {load.map((day) => {
        const height = 9 + Math.round((day.count / max) * (day.isToday ? 34 : 30))
        const tone = day.overdue
          ? 'bg-[#c98281]'
          : day.isToday
            ? 'bg-lime-400'
            : day.date > today
              ? 'bg-[#3d5230]'
              : 'bg-[#374a2b]'

        // Inert unless someone wants to act on a day — a button that does
        // nothing is worse than a bar that never claimed to be one.
        const Bar = onSelectDay ? 'button' : 'div'

        return (
          <Bar
            key={day.date.toISOString()}
            {...(onSelectDay
              ? { type: 'button', onClick: () => onSelectDay(day.date) }
              : { 'aria-hidden': 'true' })}
            title={`${formatDate(day.date)} — ${countWith(day.count, FORMS.rzecz)}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            <span
              className={['w-full rounded-sm transition-all duration-200 ease-out', tone].join(' ')}
              style={{ height: `${height}px` }}
            />
            <span
              className={[
                'text-[9.5px] sm:text-[10px]',
                day.isToday ? 'font-bold text-lime-400' : 'text-[#99ad7a]',
              ].join(' ')}
            >
              {day.isToday ? 'dziś' : WEEKDAY_SHORT[day.date.getDay()]}
            </span>
          </Bar>
        )
      })}
    </div>
  )
}
