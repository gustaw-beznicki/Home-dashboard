// The Ogarniamy mark, v3 — geometry imported 1:1 from the claude.ai/design
// project (guidelines/logo.card.html + assets/logo-*.svg; mirrored in
// docs/brandguide.html). A house with an eave and a floor with a gap for the
// sprout. Inside, a fountain-built plant: four branches rising from a single
// base at (16,25.1), three filled balls (the things to remember) and two
// outlined leaves with a vein. The balls are the only filled shapes — the
// leaves deliberately stay contour.
//
// Stroke weights are part of the mark: house 1.2 · branches 1.05 · leaf 0.95
// · vein 0.72 — lighter than UI icons on purpose, so the mark never competes
// with content. Don't thicken them to lucide weight and don't fill the leaves;
// those are the two quickest ways to make it stop being this mark.
//
// The badge ring is the letter O, not a circle: the outline is circular but
// its counter is an ellipse (rx 9.19 / ry 10.65), so the sides run thick and
// the top/bottom thin. That's why the badge can stand in for the O of
// "Ogarniamy" in the lockup. Don't replace it with a constant-stroke ring —
// it turns into a rubber stamp. Proportions were measured from the client's
// reference, not eyeballed.
//
//   Logo       — the bare mark ("znak"); size floor 30px
//   LogoBadge  — the mark in the O-ring ("sygnet"); size floor 26px
//   LogoLockup — sygnet standing in for the O of "Ogarniamy"
//
// Colour rides on currentColor. The default pairing is brand forest
// (#546b41, kotwica zieleń) on light surfaces and brand sand (#dcccac,
// kotwica piasek) on dark ones — Paleta 2 — but callers on unusual surfaces (the hero
// panel, muted footers) can override via className.

function MarkPaths() {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4.1L2.6 14.6H6.1V27.4H14.4" />
        <path d="M16 4.1L29.4 14.6H25.9V27.4H16.5" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 27.4V12.17" />
        <path d="M16 25.1Q12.7 19.8 12.3 16" />
        <path d="M16 25.1Q19.5 22.9 20.6 19.9" />
        <path d="M16 25.1Q18.9 20.2 19.4 15.7" />
        <path d="M16 25.1Q13.4 23.5 12.4 21.4" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="0.95" strokeLinejoin="round">
        <path d="M19.4 15.7Q22.93 15.52 23.2 12Q19.67 12.18 19.4 15.7Z" />
        <path d="M12.4 21.4Q12.13 17.88 8.6 17.7Q8.87 21.22 12.4 21.4Z" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="0.72" strokeLinecap="round">
        <path d="M19.86 15.26Q20.81 12.96 21.72 13.9" />
        <path d="M11.94 20.96Q9.63 20.07 10.54 19.13" />
      </g>
      <g fill="currentColor">
        <circle cx="16" cy="10.9" r="1.62" />
        <circle cx="12.3" cy="14.7" r="1.62" />
        <circle cx="21.8" cy="19.2" r="1.62" />
      </g>
    </>
  )
}

function BadgePaths() {
  return (
    <>
      <circle cx="16" cy="16" r="14.27" fill="none" stroke="currentColor" strokeWidth="0.85" />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M3.76 16A12.24 12.24 0 1 0 28.24 16A12.24 12.24 0 1 0 3.76 16ZM6.81 16A9.19 10.65 0 1 0 25.19 16A9.19 10.65 0 1 0 6.81 16Z"
      />
      <g transform="translate(16 14.72) scale(0.61) translate(-16 -15.75)">
        <MarkPaths />
      </g>
    </>
  )
}

export function Logo({ size = 30, className = 'text-brand-forest dark:text-brand-sand', label = 'Ogarniamy' }) {
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
      <MarkPaths />
    </svg>
  )
}

export function LogoBadge({ size = 30, className = 'text-brand-forest dark:text-brand-sand', label = 'Ogarniamy' }) {
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
      <BadgePaths />
    </svg>
  )
}

// The lockup is an SVG with real text (same proportions as the design
// project's logo-lockup.svg), so badge-to-wordmark alignment can't drift with
// the surrounding layout. It reads "Ogarniamy" with the sygnet as the O —
// the wordmark only spells the remaining letters. DM Sans is loaded globally
// (index.css), so <text> resolves to the same font as the page.
export function LogoLockup({ size = 48, className = 'text-brand-forest dark:text-brand-sand', label = 'Ogarniamy' }) {
  return (
    <svg
      height={size ?? undefined}
      viewBox="0 0 246 60"
      role="img"
      aria-label={label || 'Ogarniamy'}
      className={['shrink-0', className].join(' ')}
    >
      <g transform="translate(1 1) scale(1.81)">
        <BadgePaths />
      </g>
      <text
        x="60"
        y="43"
        fontFamily="'DM Sans', ui-sans-serif, system-ui, sans-serif"
        fontSize="36"
        fontWeight="500"
        letterSpacing="-0.8"
        fill="currentColor"
      >
        garniamy
      </text>
    </svg>
  )
}
