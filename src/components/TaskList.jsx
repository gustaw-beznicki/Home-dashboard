import { TaskCard } from './TaskCard'
import { STATUS_MARK_CLASS } from '../lib/constants'

// Urgency is the structure of the page now, not a tab bar: one list with a few
// stops. The marker's shape carries the status alongside its colour, so the
// grouping reads the same without colour vision.
function SectionHeading({ section }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5 px-1">
      <span className={STATUS_MARK_CLASS[section.mark]} />
      <h2 className="text-[15px] font-medium text-moss-800 dark:text-moss-300">{section.label}</h2>
      <span className="text-[13px] text-moss-500 dark:text-moss-600">{section.tasks.length}</span>
    </div>
  )
}

export function TaskList({ sections, today, onDone, onUndo, onOpen, rolledBackId }) {
  return (
    <div className="flex flex-col gap-5.5">
      {sections
        .filter((section) => section.tasks.length > 0)
        .map((section) => (
          <section key={section.key}>
            <SectionHeading section={section} />
            <div
              className={[
                'grid gap-2.5 lg:grid-cols-2',
                section.mark === 'later' ? 'gap-2' : '',
              ].join(' ')}
            >
              {section.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  today={today}
                  onDone={onDone}
                  onUndo={onUndo}
                  onOpen={onOpen}
                  rolledBack={rolledBackId === task.id}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
