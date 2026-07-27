import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayLoad, toISODate } from '../lib/recurrence'
import { countWith, FORMS, formatDate, formatDayRange } from '../lib/plural'
import { COPY } from '../lib/constants'

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
 * It is also the app's only navigation through time. A bar filters the list to
 * the day it counted, and the arrows page the window a week at a time — the
 * chart was the one place that already knew about next Thursday, and until it
 * could be clicked that knowledge went nowhere.
 *
 * The bar and label colours are the design's `--strip-bar` and `--strip-label`,
 * which deliberately have no dark-mode variant: the hero is dark in both themes,
 * so a role colour that flips would break on one of them.
 */
export function DayStrip({
  tasks,
  today,
  days = 12,
  offset = 0,
  onOffsetChange,
  selectedDay,
  onSelectDay,
}) {
  const load = dayLoad(tasks, today, days, offset)
  const max = Math.max(1, ...load.map((d) => d.count))
  const pageable = Boolean(onOffsetChange)

  return (
    <div>
      {pageable && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Nudge
            direction="prev"
            label={COPY.stripPrev}
            onClick={() => onOffsetChange(offset - 7)}
          />

          <div className="flex min-w-0 items-center gap-2">
            {/* The range is what makes paging legible: two taps in and the bars
                alone no longer say which week is on screen. */}
            <span className="truncate text-[10.5px] uppercase tracking-[0.12em] text-lime-400">
              {formatDayRange(load[0].date, load[load.length - 1].date)}
            </span>
            {/* Beside the range, not in place of the forward arrow. Replacing the
                arrow made a second week forward unreachable — the way back has to
                cost an extra control, not the way on. */}
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => onOffsetChange(0)}
                className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] text-moss-200 hover:bg-white/20"
              >
                {COPY.stripToday}
              </button>
            )}
          </div>

          <Nudge
            direction="next"
            label={COPY.stripNext}
            onClick={() => onOffsetChange(offset + 7)}
          />
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {load.map((day) => {
          const iso = toISODate(day.date)
          const picked = selectedDay === iso
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
              key={iso}
              {...(onSelectDay
                ? {
                    type: 'button',
                    onClick: () => onSelectDay(picked ? null : iso),
                    'aria-pressed': picked,
                    // The visible labels are three characters of weekday and a
                    // number; the full date and count belong in the name.
                    'aria-label': `${formatDate(day.date, { withWeekday: true })} — ${countWith(
                      day.count,
                      FORMS.rzecz
                    )}`,
                  }
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
                  className={[
                    'w-full rounded-sm transition-all duration-200 ease-out',
                    tone,
                    picked ? 'ring-2 ring-lime-400 ring-offset-1 ring-offset-hero' : '',
                  ].join(' ')}
                  style={{ height: `${height}px` }}
                />
              </span>

              <span
                className={[
                  'text-[9.5px] text-lime-400',
                  day.isToday || picked ? 'font-bold' : '',
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
    </div>
  )
}

function Nudge({ direction, label, onClick }) {
  const Icon = direction === 'prev' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-white/10 text-lime-400 hover:bg-white/20"
    >
      <Icon size={15} strokeWidth={2.2} />
    </button>
  )
}
