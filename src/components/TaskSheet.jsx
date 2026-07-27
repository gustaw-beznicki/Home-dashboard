import { useEffect, useRef, useState } from 'react'
import { Archive, ArchiveRestore, Check, Pin, Trash2, X } from 'lucide-react'
import { RhythmEditor } from './RhythmEditor'
import { CategoryIcon } from './CategoryIcon'
import { COPY } from '../lib/constants'
import { useCategories } from '../hooks/useCategories'
import { useHomeSettings } from '../hooks/useHomeSettings'
import { intervalKey, isoWeekday, rebaseInterval, toISODate } from '../lib/recurrence'

// The interval a fresh task starts from follows the household's "domyślny rytm
// nowych rzeczy" setting (Panel domu), anchored on today.
function defaultInterval(defaultRhythm, today) {
  const startsOn = toISODate(today)
  if (defaultRhythm === 'manual') return { type: 'manual' }
  if (defaultRhythm === 'monthly') {
    return {
      type: 'monthly',
      every: 1,
      unit: 'month',
      day: Math.min(today.getDate(), 28),
      startsOn,
    }
  }
  return { type: 'weekly', weekdays: [isoWeekday(today)], startsOn }
}

function initialForm(task, draft, today, defaultRhythm) {
  if (task) return task
  return {
    name: '',
    category: 'home',
    interval: defaultInterval(defaultRhythm, today),
    note: '',
    lastDone: null,
    pinned: false,
    archived: false,
    ...draft,
  }
}

/**
 * The task sheet: rises from the bottom on a phone, a right-hand panel on a
 * desktop. Replaces the old modal TaskForm — same fields minus priority, plus
 * the rhythm anchor. Everything that isn't "tick it off" lives here.
 */
export function TaskSheet({
  task,
  draft,
  today,
  onSave,
  onClose,
  onDelete,
  onArchive,
  onTogglePin,
  onDone,
}) {
  const categories = useCategories()
  const { defaultRhythm } = useHomeSettings()
  const [form, setForm] = useState(() => initialForm(task, draft, today, defaultRhythm))
  const [rebase, setRebase] = useState('lastDone')
  const originalInterval = useRef(intervalKey(initialForm(task, draft, today, defaultRhythm).interval))
  const nameRef = useRef(null)

  const isNew = !task
  const nameMissing = !form.name.trim()
  // Pusta lista dni przy rytmie tygodniowym: bez tego zapis przechodzi, a
  // terminy po cichu lecą wg dnia tygodnia kotwicy, nie wg tego, co widać.
  const weekdaysMissing =
    form.interval.type === 'weekly' && !form.interval.weekdays?.length
  const incomplete = nameMissing || weekdaysMissing
  const intervalChanged = intervalKey(form.interval) !== originalInterval.current

  useEffect(() => {
    if (isNew) nameRef.current?.focus()
  }, [isNew])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const save = () => {
    if (incomplete) return
    onSave({
      ...form,
      name: form.name.trim(),
      interval: intervalChanged ? rebaseInterval(form.interval, today, rebase) : form.interval,
    })
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-40 flex items-end bg-moss-900/45 sm:items-stretch sm:justify-end"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? COPY.formNew : COPY.formEdit}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-sheet bg-moss-50 px-4.5 pb-6 pt-3.5 shadow-sheet transition-transform duration-260 ease-sheet sm:h-full sm:max-h-none sm:w-[440px] sm:rounded-none sm:border-l sm:border-moss-300 sm:px-6 sm:py-6 sm:shadow-pop dark:bg-bark-800 dark:sm:border-bark-600"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-moss-300 sm:hidden dark:bg-bark-600" />

        <div className="mb-4.5">
          <div className="flex items-center justify-between gap-3">
            <input
              ref={nameRef}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder={COPY.namePlaceholder}
              aria-label={isNew ? COPY.formNew : COPY.formEdit}
              aria-required="true"
              aria-describedby={nameMissing ? 'task-name-hint' : undefined}
              className="min-w-0 flex-1 border-b-[1.5px] border-moss-200 bg-transparent pb-2.5 text-[21px] text-moss-900 outline-hidden placeholder:text-moss-400 focus:border-forest-600 dark:border-bark-600 dark:text-moss-100"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label={COPY.cancel}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-moss-100 text-moss-700 dark:bg-bark-700 dark:text-moss-400"
            >
              <X size={15} strokeWidth={2.2} />
            </button>
          </div>
          {/* Sąsiaduje z polem, a nie z wyszarzonym przyciskiem na dole: przy
              rozwiniętym edytorze rytmu przycisk bywa poza ekranem. */}
          {nameMissing && (
            <p
              id="task-name-hint"
              className="mt-2 text-[12.5px] text-moss-600 dark:text-moss-500"
            >
              {COPY.nameRequired}
            </p>
          )}
        </div>

        <p className="mb-2.5 text-[13.5px] font-medium text-moss-800 dark:text-moss-300">
          {COPY.fieldCategory}
        </p>
        <div className="mb-4.5 flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const active = form.category === category.key
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={active}
                onClick={() => set({ category: category.key })}
                className={[
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-[13.5px]',
                  active
                    ? 'bg-forest-600 font-medium text-onaccent'
                    : 'bg-moss-100 text-moss-700 dark:bg-bark-700 dark:text-moss-400',
                ].join(' ')}
              >
                <CategoryIcon category={category.key} size={14} />
                {category.label}
              </button>
            )
          })}
        </div>

        <RhythmEditor
          value={form.interval}
          onChange={(interval) => set({ interval })}
          today={today}
          lastDone={form.lastDone}
          rebaseChoice={!isNew && form.lastDone && intervalChanged ? rebase : null}
          onRebase={setRebase}
        />

        <div className="mt-4.5">
          <label
            htmlFor="task-last-done"
            className="mb-2 flex items-baseline gap-2 text-[13.5px] font-medium text-moss-800 dark:text-moss-300"
          >
            {COPY.fieldLastDone}
            <OptionalTag />
          </label>
          <input
            id="task-last-done"
            type="date"
            value={form.lastDone || ''}
            max={toISODate(today)}
            onChange={(e) => set({ lastDone: e.target.value || null })}
            className="w-full rounded-2xl border border-moss-300 bg-transparent px-3.5 py-3 text-[14px] text-moss-900 outline-hidden focus:border-forest-600 dark:border-bark-600 dark:text-moss-100"
          />
        </div>

        <div className="mt-4.5">
          <label
            htmlFor="task-note"
            className="mb-2 flex items-baseline gap-2 text-[13.5px] font-medium text-moss-800 dark:text-moss-300"
          >
            {COPY.fieldNote}
            <OptionalTag />
          </label>
          <textarea
            id="task-note"
            rows={2}
            value={form.note || ''}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={COPY.notePlaceholder}
            className="w-full resize-none rounded-2xl bg-moss-50 px-3.5 py-3 text-[13.5px] leading-relaxed text-moss-800 outline-hidden placeholder:text-moss-500 dark:bg-bark-700 dark:text-moss-300"
          />
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={save}
            disabled={incomplete}
            className="h-[52px] flex-1 rounded-full bg-cta text-[14.5px] font-medium text-onaccent disabled:opacity-40"
          >
            {isNew ? COPY.create : COPY.save}
          </button>

          {!isNew && (
            <>
              <SheetAction
                label={form.pinned ? COPY.unpin : COPY.pin}
                onClick={() => onTogglePin(form)}
              >
                <Pin size={17} strokeWidth={1.8} className={form.pinned ? 'fill-current' : ''} />
              </SheetAction>
              <SheetAction
                label={form.archived ? COPY.unarchive : COPY.archive}
                onClick={() => onArchive(form)}
              >
                {form.archived ? (
                  <ArchiveRestore size={17} strokeWidth={1.8} />
                ) : (
                  <Archive size={17} strokeWidth={1.8} />
                )}
              </SheetAction>
              <SheetAction label={COPY.remove} tone="danger" onClick={() => onDelete(form)}>
                <Trash2 size={17} strokeWidth={1.8} />
              </SheetAction>
            </>
          )}
        </div>

        {/* The card only offers "done" for what's due or overdue. Completing
            something early has to be possible too, and going through the
            complete endpoint is what records who did it. */}
        {!isNew && form.lastDone !== toISODate(today) && (
          <button
            type="button"
            onClick={() => onDone(form)}
            className="mt-2.5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-lime-400 text-[14.5px] font-medium text-forest-700 hover:bg-lime-300 active:bg-lime-500"
          >
            <Check size={19} strokeWidth={2.6} />
            {COPY.done}
          </button>
        )}
      </div>
    </div>
  )
}

// Oznaczamy to, co można pominąć, a nie to, co wymagane: wymagana jest tylko
// nazwa, więc gwiazdki przy wszystkim innym byłyby szumem.
function OptionalTag() {
  return (
    <span className="text-[11.5px] font-normal text-moss-600 dark:text-moss-500">
      {COPY.fieldOptional}
    </span>
  )
}

function SheetAction({ label, onClick, tone, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full bg-moss-100 dark:bg-bark-700',
        tone === 'danger' ? 'text-clay-500' : 'text-moss-700 dark:text-moss-400',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
