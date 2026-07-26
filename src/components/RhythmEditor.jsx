import { AlertTriangle, CalendarDays } from 'lucide-react'
import { COPY, MONTHLY_MODES, RHYTHMS, SLIDER_STOPS, WEEKDAYS } from '../lib/constants'
import { useHomeSettings } from '../hooks/useHomeSettings'
import { addDays, describeInterval, isoWeekday, parseISODate, toISODate, upcomingOccurrences } from '../lib/recurrence'
import { countWith, FORMS, formatDate, weekdayName } from '../lib/plural'

const REBASE_OPTIONS = [
  { key: 'lastDone', label: 'licz od ostatniego zrobienia' },
  { key: 'today', label: 'licz od dziś, zacznij na nowo' },
]

/**
 * Rhythm and "from when" are always shown together, because the anchor is what
 * the whole repetition hangs off: without it "every 3 days" has nothing to
 * count from and the user is left guessing. That is why `startsOn` is never
 * collapsed away, and why the next three deadlines are previewed before saving.
 */
export function RhythmEditor({ value, onChange, today, lastDone, rebaseChoice, onRebase }) {
  const interval = value
  const startsOn = interval.startsOn ? parseISODate(interval.startsOn) : today
  const preview = upcomingOccurrences(interval, today, 3)

  // "Tydzień zaczyna się od" (Panel domu) decides which day leads the weekday
  // chips. Presentation only — the stored ISO weekday keys don't change.
  const { weekStart } = useHomeSettings()
  const weekdays = weekStart === 7 ? [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)] : WEEKDAYS

  const set = (patch) => onChange({ ...interval, ...patch })

  const setType = (type) => {
    if (type === 'manual') return onChange({ type: 'manual' })

    const base = { type, startsOn: interval.startsOn || toISODate(today) }
    if (type === 'everyNDays') base.n = interval.n || 3
    if (type === 'weekly') {
      base.weekdays = interval.weekdays?.length ? interval.weekdays : [isoWeekday(startsOn)]
    }
    if (type === 'monthly') base.day = interval.day ?? 'first'
    onChange(base)
  }

  return (
    <div className="space-y-4.5">
      <div>
        <p className="mb-2.5 text-[13.5px] font-medium text-moss-800 dark:text-moss-300">
          {COPY.fieldRhythm}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RHYTHMS.map((rhythm) => (
            <button
              key={rhythm.type}
              type="button"
              onClick={() => setType(rhythm.type)}
              aria-pressed={interval.type === rhythm.type}
              className={[
                'rounded-full px-3.5 py-2.5 text-[14px] transition',
                interval.type === rhythm.type
                  ? 'bg-forest-600 font-medium text-moss-100'
                  : 'bg-moss-100 text-moss-700 hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400',
              ].join(' ')}
            >
              {rhythm.label}
            </button>
          ))}
        </div>
      </div>

      {interval.type === 'everyNDays' && (
        <div className="rounded-hero bg-forest-600 p-4.5 text-moss-100">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <span className="text-[22px]">
              co <b className="font-medium text-lime-400">{interval.n}</b>{' '}
              {interval.n === 1 ? 'dzień' : 'dni'}
            </span>
            <span className="text-[12px] text-[#a9c9a5]">
              {countWith(Math.max(1, Math.round(30 / interval.n)), FORMS.raz)} w miesiącu
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={SLIDER_STOPS.length - 1}
            step={1}
            value={Math.max(0, SLIDER_STOPS.indexOf(interval.n))}
            onChange={(e) => set({ n: SLIDER_STOPS[Number(e.target.value)] })}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#456b50] accent-lime-400"
            aria-label="Co ile dni"
          />
          <div className="mt-2.5 flex justify-between text-[11px] text-[#7d9c79]">
            {[1, 3, 7, 14, 30, 90].map((stop) => (
              <span key={stop}>{stop}</span>
            ))}
          </div>
        </div>
      )}

      {interval.type === 'weekly' && (
        <div>
          <p className="mb-2.5 text-[13.5px] font-medium text-moss-800 dark:text-moss-300">
            {COPY.fieldWeekdays}
          </p>
          <div className="flex gap-1.5">
            {weekdays.map((day) => {
              const on = (interval.weekdays || []).includes(day.key)
              return (
                <button
                  key={day.key}
                  type="button"
                  aria-label={day.label}
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      weekdays: on
                        ? interval.weekdays.filter((w) => w !== day.key)
                        : [...(interval.weekdays || []), day.key].sort((a, b) => a - b),
                    })
                  }
                  className={[
                    'grid aspect-square flex-1 place-items-center rounded-full text-[13px]',
                    on
                      ? 'bg-forest-600 font-medium text-moss-100'
                      : 'bg-moss-100 text-moss-600 dark:bg-bark-700 dark:text-moss-400',
                  ].join(' ')}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {interval.type === 'monthly' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {MONTHLY_MODES.map((mode) => {
            const active =
              (mode.key === 'day' && typeof interval.day === 'number') ||
              (mode.key === 'nth' && typeof interval.day === 'object' && interval.day !== null) ||
              interval.day === mode.key

            const showDayInput = mode.key === 'day' && typeof interval.day === 'number'

            // The day-number field sits beside the option rather than inside
            // it — a button may not contain an input.
            return (
              <div
                key={mode.key}
                className={[
                  'flex items-center gap-3 rounded-2xl pr-4',
                  active
                    ? 'bg-forest-600 text-moss-100'
                    : 'bg-moss-50 text-moss-800 dark:bg-bark-700 dark:text-moss-300',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    set({
                      day:
                        mode.key === 'day' ? 15 : mode.key === 'nth' ? { nth: 1, weekday: 6 } : mode.key,
                    })
                  }
                  className="flex flex-1 items-center gap-3 py-3.5 pl-4 text-left"
                >
                  <span
                    className={[
                      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2',
                      active ? 'border-lime-400' : 'border-moss-400',
                    ].join(' ')}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-lime-400" />}
                  </span>
                  <span className="flex-1 text-[13.5px]">{mode.label}</span>
                </button>

                {showDayInput ? (
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={interval.day}
                    aria-label="Dzień miesiąca"
                    onChange={(e) =>
                      set({ day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })
                    }
                    className="w-14 shrink-0 rounded-full bg-moss-200 px-2.5 py-1 text-center text-[12.5px] text-moss-700"
                  />
                ) : (
                  mode.hint && <span className="shrink-0 text-[12px] opacity-70">{mode.hint}</span>
                )}
              </div>
            )
          })}
          <p className="col-span-full flex items-start gap-2.5 rounded-2xl bg-amber-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-500 dark:bg-[#332a19]">
            <AlertTriangle size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            W lutym „ostatni dzień” to 28., a w roku przestępnym 29. Sami to ogarniemy.
          </p>
        </div>
      )}

      {interval.type === 'manual' ? (
        <p className="rounded-2xl bg-moss-100 px-3.5 py-3.5 text-[13px] leading-relaxed text-moss-700 dark:bg-bark-700 dark:text-moss-400">
          Nic samo nie wróci na listę. Zadanie siedzi w „Na spokojnie”, dopóki go nie przypniesz.
        </p>
      ) : (
        <div>
          <p className="text-[13.5px] font-medium text-moss-800 dark:text-moss-300">
            {COPY.fieldAnchor}
          </p>
          <p className="mb-2.5 mt-1 text-[12.5px] leading-relaxed text-moss-600 dark:text-moss-500">
            {COPY.fieldAnchorHint}
          </p>
          <div className="mb-2.5 flex gap-1.5">
            {[
              { label: 'od dziś', date: today },
              { label: 'od jutra', date: addDays(today, 1) },
            ].map((quick) => {
              const active = interval.startsOn === toISODate(quick.date)
              return (
                <button
                  key={quick.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ startsOn: toISODate(quick.date) })}
                  className={[
                    'flex-1 rounded-2xl py-2.5 text-[13.5px]',
                    active
                      ? 'bg-forest-600 font-medium text-moss-100'
                      : 'bg-moss-100 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                  ].join(' ')}
                >
                  {quick.label}
                </button>
              )
            })}
            <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-moss-100 py-2.5 text-[13.5px] text-moss-700 focus-within:ring-2 focus-within:ring-forest-500 dark:bg-bark-700 dark:text-moss-400">
              <CalendarDays size={16} strokeWidth={1.8} />
              inna data
              <input
                type="date"
                aria-label={COPY.fieldAnchor}
                value={interval.startsOn || toISODate(today)}
                onChange={(e) => e.target.value && set({ startsOn: e.target.value })}
                className="sr-only"
              />
            </label>
          </div>
          <p className="text-[13px] text-moss-700 dark:text-moss-400">
            {weekdayName(startsOn)}, {formatDate(startsOn)}
          </p>
        </div>
      )}

      {/* Editing an existing task: changing the rhythm moves the next deadline,
          so ask what to count from rather than silently picking one. */}
      {lastDone && rebaseChoice && interval.type !== 'manual' && (
        <div className="space-y-2">
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-500 dark:bg-[#332a19]">
            <AlertTriangle size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            Zmiana rytmu przesunie następny termin. Od czego liczyć?
          </p>
          {REBASE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={rebaseChoice === option.key}
              onClick={() => onRebase(option.key)}
              className={[
                'flex w-full items-center gap-3 rounded-2xl px-3.5 py-3.5 text-left text-[14px]',
                rebaseChoice === option.key
                  ? 'bg-forest-600 font-medium text-moss-100'
                  : 'bg-moss-50 text-moss-800 dark:bg-bark-700 dark:text-moss-300',
              ].join(' ')}
            >
              <span
                className={[
                  'h-[18px] w-[18px] shrink-0 rounded-full border-2',
                  rebaseChoice === option.key ? 'border-lime-400 bg-lime-400/30' : 'border-moss-400',
                ].join(' ')}
              />
              {option.label}
            </button>
          ))}
        </div>
      )}

      {interval.type !== 'manual' && preview.length > 0 && (
        <div className="rounded-[20px] bg-moss-100 px-4 py-3.5 dark:bg-bark-700">
          <p className="mb-2.5 text-[10.5px] uppercase tracking-[0.15em] text-moss-600 dark:text-moss-500">
            {COPY.preview}
          </p>
          <div className="flex gap-2">
            {preview.map((date) => (
              <div
                key={date.toISOString()}
                className="flex-1 rounded-2xl bg-white px-3 py-2.5 dark:bg-bark-800"
              >
                <p className="text-[15px] font-medium text-moss-900 dark:text-moss-100">
                  {formatDate(date)}
                </p>
                <p className="text-[11.5px] text-moss-600 dark:text-moss-500">{weekdayName(date)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[13px] text-moss-700 dark:text-moss-400">
            {describeInterval(interval)}
          </p>
        </div>
      )}
    </div>
  )
}
