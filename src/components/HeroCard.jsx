import { DayProgress } from './DayProgress'
import { DayStrip } from './DayStrip'
import { COPY } from '../lib/constants'
import { summarise, toISODate } from '../lib/recurrence'
import { countWith, FORMS, summarySentence } from '../lib/plural'

// The headline replaced an old percentage bar: for ten-to-forty tasks and two
// people a percentage carried no information, so the KPI is a sentence and the
// shape of the week is a strip of bars. `progress` is a narrower thing and came
// back for a narrower reason — how much of *today* is off the list, which the
// sentence states in words and the bar shows moving.
export function HeroCard({ tasks, today, weekStats, progress, onSelectDay }) {
  const counts = summarise(tasks, today)

  return (
    <div className="flex flex-col gap-4.5 lg:flex-row">
      <div className="flex-1 rounded-hero bg-hero px-4.5 py-5 text-moss-200 lg:px-5.5">
        <div className="lg:flex lg:items-center lg:gap-6">
          <div className="mb-4.5 lg:mb-0 lg:max-w-[230px] lg:flex-none">
            <p className="text-[24px] leading-tight text-balance">{summarySentence(counts)}</p>
            <Subline tasks={tasks} today={today} />
          </div>
          <div className="lg:min-w-0 lg:flex-1">
            <DayStrip tasks={tasks} today={today} onSelectDay={onSelectDay} />
          </div>
        </div>

        {progress && (
          <div className="mt-4.5">
            <DayProgress done={progress.done} total={progress.total} />
          </div>
        )}
      </div>

      {weekStats && (
        <div className="hidden w-[150px] flex-none flex-col justify-between rounded-hero bg-moss-50 p-4.5 shadow-card lg:flex dark:bg-bark-800">
          <p className="text-[10.5px] uppercase tracking-[0.15em] text-moss-500">
            {COPY.weekTitle}
          </p>
          <div>
            <p className="text-[34px] leading-none text-moss-900 dark:text-moss-100">
              {weekStats.total}
            </p>
            <p className="text-[12.5px] text-moss-600 dark:text-moss-500">{COPY.weekDone}</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-moss-700 dark:text-moss-400">
            {weekStats.byPerson.slice(0, 3).map((person, i) => (
              <li key={person.name} className="flex items-center gap-1.5">
                <span
                  className={[
                    'h-[9px] w-[9px] rounded-full',
                    i === 0 ? 'bg-[#3d5230] dark:bg-plant-500' : 'bg-lime-400',
                  ].join(' ')}
                />
                {person.name} {person.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Warmer than a counter: the most recent thing that left the list today, and
// who took it. Phrased without a verb so it needs no grammatical gender.
function Subline({ tasks, today }) {
  const iso = toISODate(today)
  const doneToday = tasks.filter((t) => !t.archived && t.lastDone === iso)
  if (!doneToday.length) return null

  const latest = doneToday[doneToday.length - 1]
  const who = latest.completedBy?.name || latest.completedBy?.email
  const rest = doneToday.length - 1

  return (
    <p className="mt-1 text-[13px] text-lime-400">
      Dziś z listy: {latest.name}
      {who ? ` — ${who}` : ''}
      {rest > 0 ? ` (+ ${countWith(rest, FORMS.rzecz)})` : ''}
    </p>
  )
}
