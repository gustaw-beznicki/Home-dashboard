import { TriangleAlert } from 'lucide-react'
import { COPY } from '../lib/constants'

/**
 * A write that failed and was undone locally. The card itself already flashes
 * once, but the flash is over in a second and the change is gone for good, so
 * this stays until the person does something about it.
 *
 * It names the thing and offers the same action again, which is the whole point:
 * "Ponów" re-fires the exact write that failed, not a refetch. A button that
 * only reloaded the list would leave the tick undone while looking like it had
 * fixed something.
 */
export function RollbackBanner({ name, onRetry }) {
  return (
    <div className="mb-3.5 flex items-start gap-3 rounded-card bg-clay-100 px-4 py-3.5 text-clay-700 dark:bg-[#301717] dark:text-[#e4a9a8]">
      <TriangleAlert size={18} strokeWidth={1.9} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{COPY.rollbackTitle}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed opacity-85">
          {name ? `„${name}” ` : ''}
          {COPY.rollbackHint}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-full bg-cta px-3.5 py-2 text-[12.5px] font-medium text-onaccent hover:bg-cta-hover"
      >
        {COPY.rollbackRetry}
      </button>
    </div>
  )
}
