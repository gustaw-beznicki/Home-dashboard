import { useState } from 'react'
import { Plus } from 'lucide-react'
import { COPY } from '../lib/constants'

/**
 * Quick add. Typing a name and pressing Enter opens the sheet with that name
 * already filled in, so the rhythm — the part that actually needs a decision —
 * is confirmed rather than guessed.
 *
 * Direction 3b turns this field into an AI input: one sentence in, name +
 * category + rhythm + anchor out, shown as editable chips. That needs a
 * Worker-side model (`POST /api/tasks/parse`) and a key, so it is deliberately
 * not wired up yet — see docs/runbooks/quickadd-ai-parse.md. This is the plain
 * input the design specifies as that feature's fallback.
 */
export function QuickAdd({ onDraft }) {
  const [value, setValue] = useState('')

  const submit = () => {
    const name = value.trim()
    if (!name) return
    setValue('')
    onDraft({ name })
  }

  return (
    <div className="flex items-center gap-2.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={COPY.quickAddPlaceholder}
        aria-label={COPY.add}
        className="h-[54px] min-w-0 flex-1 rounded-full bg-moss-50 px-4.5 text-[14.5px] text-moss-900 shadow-card outline-none placeholder:text-moss-500 focus:ring-2 focus:ring-forest-500 dark:bg-bark-800 dark:text-moss-100"
      />
      <button
        type="button"
        aria-label={COPY.add}
        onClick={value.trim() ? submit : () => onDraft({})}
        className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-cta text-onaccent"
      >
        <Plus size={20} strokeWidth={2.4} />
      </button>
    </div>
  )
}
