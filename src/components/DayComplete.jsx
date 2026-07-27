import { Check } from 'lucide-react'
import { COPY } from '../lib/constants'
import { FORMS, slownie } from '../lib/plural'

// Where each leaf starts, how far it falls, how far it turns on the way, and how
// long it waits first. Placed by hand rather than randomised: `Math.random()`
// would deal a different fall on every render, and this plays exactly once.
//
// Sizes are up from the design kit's 12–17px, which measured out as specks: a
// filled teardrop that small, mid-rotation, on a dark card reads as a dot rather
// than as a leaf. Checked against a capture with motion allowed — under reduced
// motion they are gone and none of this matters.
const LEAVES = [
  { left: '8%', delay: 0, drop: 250, spin: 180, size: 22 },
  { left: '19%', delay: 320, drop: 290, spin: -160, size: 18 },
  { left: '31%', delay: 140, drop: 270, spin: 220, size: 26 },
  { left: '44%', delay: 520, drop: 300, spin: -200, size: 19 },
  { left: '57%', delay: 60, drop: 260, spin: 240, size: 24 },
  { left: '69%', delay: 400, drop: 290, spin: -180, size: 18 },
  { left: '81%', delay: 220, drop: 280, spin: 200, size: 22 },
  { left: '92%', delay: 600, drop: 255, spin: -220, size: 20 },
]

/**
 * The reward for clearing everything that fell due today. Not an empty state —
 * an empty state says "there is nothing here", this says "you did it".
 *
 * Three rules from the design system that are not free to break:
 *
 * 1. It stands *above* the list of things just ticked off, never in its place.
 *    Taking back the last tick has to stay one tap away, or the reward removes
 *    the way to fix a mistake.
 * 2. It plays once. No looping, and no replay on every render — `playKey` keys
 *    the element, so undoing and re-ticking deals a fresh fall and nothing else
 *    does.
 * 3. The leaves are decoration, so they disappear entirely under
 *    `prefers-reduced-motion` (`[data-leaf]` in `src/index.css`). The medallion
 *    and the sentence carry the message without them.
 */
export function DayComplete({ count, playKey, onAction }) {
  return (
    // Tighter on a phone than the design kit's single size: at 390px the card
    // pushed the first "cofnij" clean off the screen, and undo has to stay within
    // reach rather than within scroll.
    <section
      key={playKey}
      className="relative animate-riseIn overflow-hidden rounded-hero bg-hero px-5 pb-7 pt-8 text-center sm:px-6 sm:pb-9.5 sm:pt-10.5"
    >
      {LEAVES.map((leaf) => (
        <span
          key={leaf.left}
          data-leaf=""
          aria-hidden="true"
          className="absolute top-0 animate-leafFall text-lime-400"
          style={{
            left: leaf.left,
            animationDelay: `${leaf.delay}ms`,
            '--leaf-drop': `${leaf.drop}px`,
            '--leaf-spin': `${leaf.spin}deg`,
          }}
        >
          {/* A pointed lens, not the kit's rounded teardrop: filled and this
              small, a shape whose sides meet in a curve reads as a dot. Two
              points and a waist is the least a leaf can be. */}
          <svg width={leaf.size} height={leaf.size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C15.5 7 15.5 17 12 22C8.5 17 8.5 7 12 2Z" />
          </svg>
        </span>
      ))}

      <div className="relative mx-auto mb-5 grid h-16 w-16 place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ringOut rounded-full border-2 border-lime-400"
        />
        <span className="grid h-16 w-16 animate-popIn place-items-center rounded-full bg-lime-400 text-[#202a14]">
          <Check size={30} strokeWidth={2.6} />
        </span>
      </div>

      <p className="relative mx-auto max-w-[20ch] animate-countUp text-[26px] leading-tight text-moss-200 [animation-delay:160ms] sm:text-[28px]">
        {COPY.dayCompleteTitle}
      </p>
      <p className="relative mx-auto mt-3 max-w-[42ch] animate-countUp text-[14px] leading-relaxed text-lime-400 [animation-delay:260ms]">
        {capitalise(slownie(count, FORMS.rzecz))} {COPY.dayCompleteTail}
      </p>

      <button
        type="button"
        onClick={onAction}
        className="relative mt-5.5 h-[46px] animate-countUp rounded-full bg-lime-400 px-5.5 text-[14px] font-medium text-[#202a14] [animation-delay:340ms]"
      >
        {COPY.dayCompleteAction}
      </button>
    </section>
  )
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
