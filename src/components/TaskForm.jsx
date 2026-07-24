import { useState } from 'react'
import { CATEGORIES, INTERVAL_TYPES, PRIORITIES } from '../lib/constants'

function initialState(task) {
  return {
    name: task?.name ?? '',
    category: task?.category ?? CATEGORIES[0].key,
    intervalType: task?.interval?.type ?? 'daily',
    intervalN: task?.interval?.type === 'everyNDays' ? task.interval.n : 3,
    priority: task?.priority ?? 'medium',
    note: task?.note ?? '',
  }
}

export function TaskForm({ mode, task, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialState(task))

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    const interval =
      form.intervalType === 'everyNDays'
        ? { type: 'everyNDays', n: Math.max(1, Number(form.intervalN) || 1) }
        : { type: form.intervalType }

    onSubmit({
      name: form.name.trim(),
      category: form.category,
      interval,
      priority: form.priority,
      note: form.note.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {mode === 'edit' ? 'Edytuj zadanie' : 'Nowe zadanie'}
        </h2>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">Nazwa</span>
          <input
            type="text"
            required
            value={form.name}
            onChange={update('name')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">Kategoria</span>
          <select
            value={form.category}
            onChange={update('category')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">Interwał</span>
          <select
            value={form.intervalType}
            onChange={update('intervalType')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {INTERVAL_TYPES.map((i) => (
              <option key={i.type} value={i.type}>
                {i.label}
              </option>
            ))}
          </select>
        </label>

        {form.intervalType === 'everyNDays' && (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">
              Co ile dni
            </span>
            <input
              type="number"
              min="1"
              value={form.intervalN}
              onChange={update('intervalN')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
        )}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">Priorytet</span>
          <select
            value={form.priority}
            onChange={update('priority')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">Notatka</span>
          <textarea
            value={form.note}
            onChange={update('note')}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Zapisz
          </button>
        </div>
      </form>
    </div>
  )
}
