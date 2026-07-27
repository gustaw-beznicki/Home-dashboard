import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayProgress } from './DayProgress'
import { DayComplete } from './DayComplete'
import { DayStrip } from './DayStrip'
import { RollbackBanner } from './RollbackBanner'
import { COPY } from '../lib/constants'

const TODAY = new Date(2026, 6, 24) // Friday 2026-07-24

describe('DayProgress', () => {
  it('shows the count next to the percentage', () => {
    render(<DayProgress done={2} total={5} />)
    expect(screen.getByText('2 z 5')).toBeInTheDocument()
    expect(screen.getByText('· 40%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  })

  it('reads an empty day as done, not as zero', () => {
    // A day with nothing due is a success. 0% would call it a failure.
    render(<DayProgress done={0} total={0} />)
    expect(screen.getByText(COPY.dayProgressEmpty)).toBeInTheDocument()
    expect(screen.getByText('· 100%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('never rounds a part-done day up to a finished one', () => {
    render(<DayProgress done={199} total={200} />)
    expect(screen.getByText('· 100%')).toBeInTheDocument()
    // Rounding is fine on the number; what must not happen is the bar looking
    // finished, so the accent colour keys off done >= total, not off the percent.
    expect(screen.getByText('· 100%').className).toContain('text-moss-200')
  })
})

describe('DayComplete', () => {
  it('names how much got done, and offers somewhere to go next', () => {
    const onAction = vi.fn()
    render(<DayComplete count={3} playKey={3} onAction={onAction} />)

    expect(screen.getByText(COPY.dayCompleteTitle)).toBeInTheDocument()
    expect(screen.getByText(/^Trzy rzeczy mniej na liście\./)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: COPY.dayCompleteAction }))
    expect(onAction).toHaveBeenCalled()
  })

  it('marks the leaves as decoration, so reduced motion can drop them', () => {
    const { container } = render(<DayComplete count={1} playKey={1} onAction={vi.fn()} />)
    const leaves = container.querySelectorAll('[data-leaf]')
    expect(leaves.length).toBeGreaterThan(0)
    for (const leaf of leaves) expect(leaf).toHaveAttribute('aria-hidden', 'true')
  })

  it('replays only when playKey changes', () => {
    const { container, rerender } = render(<DayComplete count={1} playKey={1} onAction={vi.fn()} />)
    const first = container.querySelector('section')

    // Same key, different unrelated prop: the animation must not start over.
    rerender(<DayComplete count={1} playKey={1} onAction={vi.fn()} />)
    expect(container.querySelector('section')).toBe(first)

    // Undone and re-ticked, so the fall is dealt again.
    rerender(<DayComplete count={2} playKey={2} onAction={vi.fn()} />)
    expect(container.querySelector('section')).not.toBe(first)
  })
})

describe('DayStrip', () => {
  function task(id, lastDone) {
    return {
      id,
      name: id,
      lastDone,
      interval: { type: 'daily', startsOn: '2026-07-01' },
      note: '',
      category: 'home',
      pinned: false,
      archived: false,
    }
  }

  it('puts the count above the bar, so height is not the only cue', () => {
    // Two things last done yesterday, so two things fall due today. Three days
    // of strip, so the count "2" can't collide with a day number.
    render(
      <DayStrip tasks={[task('a', '2026-07-23'), task('b', '2026-07-23')]} today={TODAY} days={3} />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('dziś')).toBeInTheDocument()
  })

  it('labels a day with its number as well as its weekday', () => {
    render(<DayStrip tasks={[]} today={TODAY} days={3} />)
    // The first bar is yesterday, which is where arrears pile up.
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })
})

describe('RollbackBanner', () => {
  it('names the thing that snapped back and offers the same write again', () => {
    const onRetry = vi.fn()
    render(<RollbackBanner name="Podlać monsterę" onRetry={onRetry} />)

    expect(screen.getByText(COPY.rollbackTitle)).toBeInTheDocument()
    expect(screen.getByText(/Podlać monsterę/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: COPY.rollbackRetry }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('still says what happened when there is no name to give', () => {
    render(<RollbackBanner name={null} onRetry={vi.fn()} />)
    expect(screen.getByText(COPY.rollbackHint)).toBeInTheDocument()
  })
})

describe('day-complete copy', () => {
  it('does not echo the hero sentence that sits above it', () => {
    // The hero already says "Dom ogarnięty." when the day is closed. The card
    // has to add something rather than repeat the word.
    expect(COPY.dayCompleteTitle).not.toMatch(/ogarni/i)
  })

  it('stays grammatical for one, two and five things', () => {
    for (const count of [1, 2, 5, 22]) {
      const { unmount } = render(<DayComplete count={count} playKey={count} onAction={vi.fn()} />)
      // No agreement with the count anywhere in the sentence, so no form of the
      // participle can be wrong.
      expect(screen.getByText(/mniej na liście\./)).toBeInTheDocument()
      unmount()
    }
  })
})
