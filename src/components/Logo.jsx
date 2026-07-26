// The Ogarniamy mark: a roof with eaves and footed walls, no floor — the
// inside belongs to the plant — and a sprout branching like a neuron, with
// filled leaves and three filled berries: the things to remember. Geometry
// traced from the client's reference (assets in the design project), on a
// 32px grid with strokes 1.9 (house) and 1.7 (sprout).
//
// Colour rides on currentColor. The default pairing is deep green on light
// surfaces and lime on dark ones — same values the design files bind to
// --logo-fg — but callers on unusual surfaces (the hero panel, muted footers)
// can override via className.
export function Logo({ size = 30, className = 'text-forest-600 dark:text-lime-400', label = 'Ogarniamy' }) {
  return (
    <svg
      width={size ?? undefined}
      height={size ?? undefined}
      viewBox="0 0 32 32"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={['shrink-0', className].join(' ')}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.4 15.4 16 4.6l12.6 10.8" />
        <path d="M6.6 13.4v12.2h3.8M25.4 13.4v12.2h-3.8" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 25.6V11.75" />
        <path d="M16 13.8L12.2 12.3" />
        <path d="M16 15.1L19.9 13.1" />
      </g>
      <g fill="currentColor">
        <path d="M16 17.4Q12.96 15.15 11.4 18.6Q14.44 20.85 16 17.4Z" />
        <path d="M16 20.2Q17.56 23.65 20.6 21.4Q19.04 17.95 16 20.2Z" />
        <path d="M16 23Q13.48 21.14 12.2 24Q14.72 25.86 16 23Z" />
        <circle cx="16" cy="10.1" r="2.05" />
        <circle cx="12.2" cy="12.3" r="1.9" />
        <circle cx="19.9" cy="13.1" r="1.8" />
      </g>
    </svg>
  )
}
