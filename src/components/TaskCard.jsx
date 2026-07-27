import { Check, Pin } from 'lucide-react'
import { CategoryIcon } from './CategoryIcon'
import { CARD_CLASS, CATEGORY_TILE_CLASS, COPY, STATUS_TEXT_CLASS } from '../lib/constants'
import { computeStatus, daysUntilDue, describeInterval, parseISODate } from '../lib/recurrence'
import { formatLastDone, relativeDue } from '../lib/plural'

/**
 * Everything is subordinate to one action — ticking the thing off. Editing,
 * pinning, archiving and deleting all live one level down, in the sheet.
 *
 * `renderAs` overrides the derived status for the whole card, and exists for one
 * caller: the Najbliższy tydzień view, which is about *when a thing next falls
 * due* and not about today. A thing ticked off this morning and due again
 * tomorrow belongs in that list, and rendering it there as a completion —
 * struck through, "cofnij", no date — answers a question nobody asked in that
 * view. It is not a lie about the data: the card is standing in for a future
 * deadline, and the quiet tier it renders as carries no tick button, so the same
 * thing can't be completed twice from there.
 */
export function TaskCard({ task, today, onDone, onUndo, onOpen, rolledBack = false, renderAs }) {
  const status = renderAs ?? computeStatus(task, today)
  const until = daysUntilDue(task, today)
  const rhythm = describeInterval(task.interval)

  // "Na spokojnie" is the quiet tier: smaller, flatter, no primary action.
  const quiet = status === 'later'

  // The quiet tier already carries the timing on its right-hand side, so the
  // meta line is the rhythm alone — otherwise every "Na spokojnie" row read
  // "za 5 dni · co miesiąc, ostatniego … za 5 dni".
  const meta =
    status === 'done'
      ? formatLastDone(parseISODate(task.lastDone), today, task.completedBy?.name)
      : quiet || until === null
        ? rhythm
        : [relativeDue(until), rhythm].filter((v, i, all) => all.indexOf(v) === i).join(' · ')

  return (
    <article
      onClick={() => onOpen(task)}
      className={[
        'relative flex items-center gap-3.5 rounded-card px-4 py-3.5 text-left transition duration-120 ease-out active:scale-[.985]',
        quiet ? 'rounded-[20px] px-3.5 py-3' : '',
        CARD_CLASS[status],
        rolledBack ? 'animate-rollback' : '',
      ].join(' ')}
    >
      <span
        className={[
          'grid shrink-0 place-items-center rounded-2xl',
          quiet ? 'h-8 w-8 rounded-xl' : 'h-[46px] w-[46px]',
          // Custom categories from Panel domu get the neutral 'home' tile.
          CATEGORY_TILE_CLASS[task.category] || CATEGORY_TILE_CLASS.home,
        ].join(' ')}
      >
        <CategoryIcon category={task.category} size={quiet ? 16 : 21} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* Stretched link: one focusable element covers the whole card, so the
              card is keyboard-operable without nesting buttons inside a button. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(task)
            }}
            className={[
              'truncate text-left after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-forest-500',
              quiet
                ? 'text-[14.5px] text-moss-800 dark:text-moss-300'
                : 'text-base font-medium text-moss-900 dark:text-moss-100',
              status === 'done' ? 'line-through decoration-moss-400' : '',
            ].join(' ')}
          >
            {task.name}
          </button>
          {task.pinned && (
            <Pin size={13} strokeWidth={2} className="shrink-0 text-moss-500" aria-label="Przypięte" />
          )}
        </div>

        <p className={['truncate text-[12.5px]', STATUS_TEXT_CLASS[status]].join(' ')}>{meta}</p>

        {task.note && !quiet && status !== 'done' && (
          <p className="mt-1 truncate text-[12.5px] text-moss-500 dark:text-moss-600">{task.note}</p>
        )}
      </div>

      {quiet ? (
        <span className="relative shrink-0 text-[12.5px] text-moss-600 dark:text-moss-500">
          {until === null ? '' : relativeDue(until)}
        </span>
      ) : status === 'done' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onUndo(task)
          }}
          className="relative shrink-0 rounded-full px-3 py-2 text-[12.5px] text-moss-600 underline underline-offset-2 dark:text-moss-500"
        >
          {COPY.undo}
        </button>
      ) : (
        <button
          type="button"
          aria-label={`${COPY.done}: ${task.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onDone(task)
          }}
          className={[
            'relative grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full transition',
            status === 'overdue'
              ? 'bg-forest-600 text-onaccent hover:bg-forest-700 active:bg-forest-700'
              : 'border-2 border-moss-300 text-moss-400 hover:border-forest-600 hover:bg-forest-600 hover:text-onaccent dark:border-bark-600',
          ].join(' ')}
        >
          <Check size={21} strokeWidth={2.6} />
        </button>
      )}
    </article>
  )
}
