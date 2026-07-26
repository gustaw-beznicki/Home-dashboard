import { Sprout, Droplets, Home, HeartPulse } from 'lucide-react'

// One resolution point for category → glyph, so the card, the sheet and the
// filter chips can never drift apart. Stroke 1.8 everywhere per the design.
const ICONS = { plants: Sprout, equipment: Droplets, home: Home, health: HeartPulse }

export function CategoryIcon({ category, size = 21, className }) {
  const Icon = ICONS[category] || Home
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />
}
