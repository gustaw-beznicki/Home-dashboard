import { COPY } from '../lib/constants'

/**
 * How much of today's load is off the list. Lives on the dark hero card and
 * nowhere else — the track and the fill are measured against that surface, which
 * stays dark in both themes, so the colours here are deliberately not the
 * theme's accent (`forest-600` would vanish on it in light mode).
 *
 * `total` counts what fell due today *including* what has already been ticked
 * off; `dayProgress` in `src/lib/recurrence.js` is where that rule lives. An
 * empty day reads 100%, not 0% — nothing due is a success, not a zero.
 */
export function DayProgress({ done, total }) {
  const pct = total === 0 ? 100 : Math.round((done / total) * 100)
  const full = done >= total

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2.5">
        <span className="text-[11px] uppercase tracking-[0.1em] text-lime-400">
          {COPY.dayProgress}
        </span>
        <span className="text-[12.5px] text-moss-200">
          {total === 0 ? COPY.dayProgressEmpty : `${done} z ${total}`}
          {/* DM Sans has proportional digits and ships no `tnum` feature, so
              `tabular-nums` changes nothing in it. Columns of numbers are held
              still by a min-width cell and right alignment instead — without it
              the percentage shoves the counter sideways as it ticks up. */}
          <span
            className={[
              'inline-block min-w-[5.76ch] text-right font-medium',
              full ? 'text-lime-400' : 'text-moss-200',
            ].join(' ')}
          >
            {` · ${pct}%`}
          </span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${COPY.dayProgress}: ${done} z ${total}`}
        className="relative h-2 overflow-hidden rounded-full bg-white/15"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-lime-400 transition-[width] duration-[240ms] ease-settle"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
