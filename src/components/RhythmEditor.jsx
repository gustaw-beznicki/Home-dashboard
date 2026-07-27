import { AlertTriangle, CalendarDays } from 'lucide-react'
import {
  COPY,
  MONTH_STEPS,
  MONTHLY_MODES,
  RHYTHMS,
  SLIDER_STOPS,
  WEEKDAYS,
  YEAR_STEPS,
} from '../lib/constants'
import { useHomeSettings } from '../hooks/useHomeSettings'
import { addDays, describeInterval, isoWeekday, parseISODate, toISODate, upcomingOccurrences } from '../lib/recurrence'
import {
  countWith,
  FORMS,
  formatDate,
  ORDINALS_ACCUSATIVE,
  weekdayName,
  WEEKDAYS_ACCUSATIVE,
} from '../lib/plural'

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

  // Which chip is lit. Months and years share `type: 'monthly'`, so the unit is
  // what separates them; anything else is decided by the type alone.
  const activeKey =
    interval.type === 'monthly' ? (interval.unit === 'year' ? 'yearly' : 'monthly') : interval.type

  const yearly = activeKey === 'yearly'
  // The nth-weekday rule, when that is what `day` holds. Its own object rather
  // than a boolean so the two selects can spread it and change one field.
  const nthRule =
    interval.type === 'monthly' && typeof interval.day === 'object' && interval.day !== null
      ? interval.day
      : null
  const steps = yearly ? YEAR_STEPS : MONTH_STEPS
  const every = Math.max(1, interval.every ?? 1)

  const setRhythm = (rhythm) => {
    if (rhythm.type === 'manual') return onChange({ type: 'manual' })

    const base = { type: rhythm.type, startsOn: interval.startsOn || toISODate(today) }
    if (rhythm.type === 'everyNDays') base.n = interval.n || 3
    if (rhythm.type === 'weekly') {
      base.weekdays = interval.weekdays?.length ? interval.weekdays : [isoWeekday(startsOn)]
    }
    if (rhythm.type === 'monthly') {
      base.unit = rhythm.unit
      // Cadence doesn't carry across units — "co 6 miesięcy" becoming "co 6 lat"
      // on one tap would be a nasty surprise.
      base.every = rhythm.unit === interval.unit ? every : 1
      // A yearly rhythm takes its date from the anchor, so it holds no day rule.
      if (rhythm.unit === 'month') base.day = interval.day ?? 'first'
    }
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
              key={rhythm.key}
              type="button"
              onClick={() => setRhythm(rhythm)}
              aria-pressed={activeKey === rhythm.key}
              className={[
                'rounded-full px-3.5 py-2.5 text-[14px] transition',
                activeKey === rhythm.key
                  ? 'bg-forest-600 font-medium text-onaccent'
                  : 'bg-moss-100 text-moss-700 hover:bg-moss-200 dark:bg-bark-700 dark:text-moss-400',
              ].join(' ')}
            >
              {rhythm.label}
            </button>
          ))}
        </div>
      </div>

      {interval.type === 'everyNDays' && (
        <div className="rounded-hero bg-hero p-4.5 text-moss-200">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <span className="text-[22px]">
              co <b className="font-medium text-lime-400">{interval.n}</b>{' '}
              {interval.n === 1 ? 'dzień' : 'dni'}
            </span>
            <span className="text-[12px] text-lime-400">
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
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#3d5230] accent-lime-400"
            aria-label="Co ile dni"
          />
          <div className="mt-2.5 flex justify-between text-[11px] text-[#99ad7a]">
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
                      ? 'bg-forest-600 font-medium text-onaccent'
                      : 'bg-moss-100 text-moss-600 dark:bg-bark-700 dark:text-moss-400',
                  ].join(' ')}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
          {/* Wyczyszczenie wszystkich chipów jest możliwe, a wtedy recurrence po
              cichu podstawia dzień tygodnia kotwicy — powiedzmy to wprost,
              zamiast zostawiać rozjazd między UI a terminami w podglądzie. */}
          {!(interval.weekdays || []).length && (
            <p className="mt-2 text-[12.5px] text-clay-500">{COPY.weekdaysRequired}</p>
          )}
        </div>
      )}

      {interval.type === 'monthly' && (
        <div>
          <p className="mb-2.5 text-[13.5px] font-medium text-moss-800 dark:text-moss-300">
            {COPY.fieldCadence}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {steps.map((step) => (
              <button
                key={step.every}
                type="button"
                aria-pressed={every === step.every}
                onClick={() => set({ every: step.every })}
                className={[
                  'rounded-full px-3.5 py-2 text-[13.5px]',
                  every === step.every
                    ? 'bg-forest-600 font-medium text-onaccent'
                    : 'bg-moss-100 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                ].join(' ')}
              >
                {step.label}
              </button>
            ))}
          </div>
          {/* A cadence the chips don't cover stays visible rather than silently
              snapping to the nearest one — a task imported as "co 4 lata" would
              otherwise look like "co rok". */}
          {!steps.some((step) => step.every === every) && (
            <p className="mt-2 text-[12.5px] text-moss-600 dark:text-moss-500">
              {describeInterval(interval)}
            </p>
          )}
        </div>
      )}

      {yearly && (
        <p className="rounded-2xl bg-moss-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-moss-700 dark:bg-bark-700 dark:text-moss-400">
          {COPY.yearlyDateHint}
        </p>
      )}

      {interval.type === 'monthly' && !yearly && (
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
                    ? 'bg-forest-600 text-onaccent'
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

          {/* Full width rather than squeezed beside the radio: two selects and
              the word joining them read as a sentence, and there is no room for
              that in a half-width cell on a phone. */}
          {nthRule && (
            <div className="col-span-full flex flex-wrap items-center gap-2 rounded-2xl bg-moss-50 px-4 py-3 text-[13.5px] text-moss-800 dark:bg-bark-700 dark:text-moss-300">
              <span>w</span>
              <select
                value={nthRule.nth}
                aria-label="Która z kolei"
                onChange={(e) => set({ day: { ...nthRule, nth: Number(e.target.value) } })}
                className="rounded-full bg-moss-200 px-2.5 py-1 text-[13px] text-moss-800 dark:bg-bark-600 dark:text-moss-200"
              >
                {ORDINALS_ACCUSATIVE.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={nthRule.weekday}
                aria-label="Dzień tygodnia"
                onChange={(e) => set({ day: { ...nthRule, weekday: Number(e.target.value) } })}
                className="rounded-full bg-moss-200 px-2.5 py-1 text-[13px] text-moss-800 dark:bg-bark-600 dark:text-moss-200"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.key} value={day.key}>
                    {WEEKDAYS_ACCUSATIVE[day.key]}
                  </option>
                ))}
              </select>
              <span className="text-moss-600 dark:text-moss-500">miesiąca</span>
            </div>
          )}

          {/* Only "ostatniego dnia" has a February problem. Under a fixed day or
              an nth-weekday rule this was answering a question nobody asked. */}
          {interval.day === 'last' && (
            <p className="col-span-full flex items-start gap-2.5 rounded-2xl bg-amber-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-500 dark:bg-[#3e3a29]">
              <AlertTriangle size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
              W lutym „ostatni dzień” to 28., a w roku przestępnym 29. Sami to ogarniemy.
            </p>
          )}
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
                      ? 'bg-forest-600 font-medium text-onaccent'
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
            {weekdayName(startsOn)},{' '}
            {formatDate(startsOn, { withYear: startsOn.getFullYear() !== today.getFullYear() })}
          </p>
        </div>
      )}

      {/* Editing an existing task: changing the rhythm moves the next deadline,
          so ask what to count from rather than silently picking one. */}
      {lastDone && rebaseChoice && interval.type !== 'manual' && (
        <div className="space-y-2">
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-100 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-500 dark:bg-[#3e3a29]">
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
                  ? 'bg-forest-600 font-medium text-onaccent'
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
                className="flex-1 rounded-2xl bg-moss-50 px-3 py-2.5 dark:bg-bark-800"
              >
                <p className="text-[15px] font-medium text-moss-900 dark:text-moss-100">
                  {formatDate(date, { withYear: date.getFullYear() !== today.getFullYear() })}
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
