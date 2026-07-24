import { TaskCard } from './TaskCard'

export function TaskList({ tasks, today, onMarkDone, onEdit, onDelete, onTogglePin, onArchive }) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
        Brak zadań w tym widoku.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          today={today}
          onMarkDone={onMarkDone}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
          onArchive={onArchive}
        />
      ))}
    </div>
  )
}
