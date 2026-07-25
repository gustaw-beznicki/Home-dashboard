import { computeStatus, daysUntilDue } from '../lib/taskLogic'
import { CATEGORY_LABELS, STATUS_CLASS_MAP, STATUS_LABELS } from '../lib/constants'

function formatDueHint(task, today) {
  if (task.interval.type === 'manual') return null
  const until = daysUntilDue(task, today)
  if (until === null) return null
  if (until === 0) return 'Termin: dzisiaj'
  if (until > 0) return `Termin za ${until} dni`
  return `Przeterminowane o ${Math.abs(until)} dni`
}

export function TaskCard({ task, today, onMarkDone, onEdit, onDelete, onTogglePin, onArchive }) {
  const status = computeStatus(task, today)
  const dueHint = formatDueHint(task, today)

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {task.pinned && <span title="Przypięte">📌</span>}
          <h3 className="font-semibold text-gray-900 dark:text-white">{task.name}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS_MAP[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{CATEGORY_LABELS[task.category]}</span>
        {task.lastDone && (
          <span>
            Ostatnio: {task.lastDone}
            {task.completedBy && ` (${task.completedBy.name || task.completedBy.email})`}
          </span>
        )}
        {dueHint && <span>{dueHint}</span>}
      </div>

      {task.note && <p className="text-sm text-gray-600 dark:text-gray-300">{task.note}</p>}

      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onMarkDone(task.id)}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          ✅ Zrobione dziś
        </button>
        <button
          type="button"
          onClick={() => onEdit(task)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          ✏️ Edytuj
        </button>
        <button
          type="button"
          onClick={() => onTogglePin(task.id)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          📌 {task.pinned ? 'Odepnij' : 'Przypnij'}
        </button>
        <button
          type="button"
          onClick={() => onArchive(task.id, !task.archived)}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
        >
          {task.archived ? '↩️ Przywróć' : '🗄️ Archiwizuj'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          🗑️ Usuń
        </button>
      </div>
    </div>
  )
}
