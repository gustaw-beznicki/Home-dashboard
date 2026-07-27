import { dayLoad } from '../lib/recurrence'
import { countWith, FORMS, formatDate } from '../lib/plural'

const WEEKDAY_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'sb']

// The bar slot is a fixed height and the bars sit on its floor, so the labels
// under it line up across the strip whatever the tallest day happens to be.
const BAR_SLOT = 50

/**
 * The house has a pulse: bar height is how much falls due that day, colour is
 * today / arrears / later, and the number above the bar is the count itself —
 * height alone tells you the shape of the week but not that Wednesday holds
 * four things. Sits inside the dark hero card. The first bar is yesterday, which
 * is where overdue work piles up.
 *
 * The bar and label colours are the design's `--strip-bar` and `--strip-label`,
 * which deliberately have no dark-mode variant: the hero is dark in both themes,
 * so a role colour that flips would break on one of them.
 */
export function DayStrip({ tasks, today, days = 12, onSelectDay }) {
  const load = dayLoad(tasks, today, days)
  const max = Math.max(1, ...load.map((d) => d.count))

  return (
    <div className="flex items-end gap-1.5">
      {load.map((day) => {
        const height = 10 + Math.round((day.count / max) * (day.isToday ? 40 : 34))
        const tone = day.overdue
          ? 'bg-clay-300'
          : day.isToday
            ? 'bg-lime-400'
            : 'bg-brand-forest'

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
            className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-400"
          >
            {/* Min-width cell, right-aligned: DM Sans has proportional digits
                and no `tnum`, so a two-digit count would otherwise widen its
                column and nudge the whole strip. */}
            <span
              className={[
                'h-3 min-w-[2.4ch] text-center text-[10px] font-medium',
                day.overdue ? 'text-clay-300' : 'text-lime-400',
              ].join(' ')}
            >
              {day.count || ''}
            </span>

            <span className="flex w-full items-end" style={{ height: `${BAR_SLOT}px` }}>
              <span
                className={['w-full rounded-sm transition-all duration-200 ease-out', tone].join(' ')}
                style={{ height: `${height}px` }}
              />
            </span>

            <span
              className={[
                'text-[9.5px] text-lime-400',
                day.isToday ? 'font-bold' : '',
              ].join(' ')}
            >
              {day.isToday ? 'dziś' : WEEKDAY_SHORT[day.date.getDay()]}
            </span>
            <span className="min-w-[2.4ch] text-center text-[9px] text-lime-400">
              {day.date.getDate()}
            </span>
          </Bar>
        )
      })}
    </div>
  )
}
