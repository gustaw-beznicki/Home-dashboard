import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskCard } from './TaskCard'
import { TaskList } from './TaskList'
import { TaskSheet } from './TaskSheet'
import { RhythmEditor } from './RhythmEditor'
import { HeroCard } from './HeroCard'
import { EmptyState } from './EmptyState'

const TODAY = new Date(2026, 6, 24) // Friday 2026-07-24

function task(overrides) {
  return {
    id: 't1',
    name: 'Podlać monsterę',
    lastDone: null,
    interval: { type: 'everyNDays', n: 3, startsOn: '2026-07-03' },
    note: '',
    category: 'plants',
    pinned: false,
    archived: false,
    completedBy: null,
    ...overrides,
  }
}

function renderCard(overrides = {}, handlers = {}) {
  const props = { onDone: vi.fn(), onUndo: vi.fn(), onOpen: vi.fn(), ...handlers }
  render(<TaskCard task={task(overrides)} today={TODAY} {...props} />)
  return props
}

describe('TaskCard', () => {
  it('says how late an overdue task is, in words', () => {
    renderCard({ lastDone: '2026-07-18' }) // next grid point was 21 July
    expect(screen.getByText(/3 dni po terminie · co 3 dni/)).toBeInTheDocument()
  })

  it('offers the primary action for something due, and reports the task it acts on', () => {
    const { onDone } = renderCard({ lastDone: '2026-07-21' })
    const button = screen.getByRole('button', { name: 'Zrobione: Podlać monsterę' })
    fireEvent.click(button)
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })

  it('swaps the action for an undo once it has been ticked off today', () => {
    const { onUndo, onDone } = renderCard({
      lastDone: '2026-07-24',
      completedBy: { email: 'a@example.com', name: 'Anna' },
    })
    expect(screen.getByText('Anna, dziś')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Zrobione/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'cofnij' }))
    expect(onUndo).toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('drops to the quiet tier with no primary action when nothing is owed yet', () => {
    renderCard({
      interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-20' },
      lastDone: '2026-07-20',
    })
    expect(screen.getByText('za 3 dni')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Zrobione/ })).not.toBeInTheDocument()
  })

  it('states the timing once in the quiet tier, not on both lines', () => {
    // Anchored 5 days out and never done, so the first deadline is 5 days away.
    renderCard({
      interval: { type: 'everyNDays', n: 5, startsOn: '2026-07-29' },
      lastDone: null,
    })
    // The right-hand side carries the timing, so the meta line is the rhythm
    // alone — anything else reads "za 5 dni · co 5 dni … za 5 dni".
    expect(screen.getByText('co 5 dni')).toBeInTheDocument()
    expect(screen.getAllByText('za 5 dni')).toHaveLength(1)
  })

  it('opens the sheet when the card is activated', () => {
    const { onOpen } = renderCard({ lastDone: '2026-07-21' })
    fireEvent.click(screen.getByRole('button', { name: 'Podlać monsterę' }))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })
})

describe('TaskList', () => {
  it('renders only the stops that have something in them, with counts', () => {
    const sections = [
      { key: 'overdue', label: 'Zaległe', mark: 'overdue', tasks: [task({ id: 'a' })] },
      { key: 'due', label: 'Na dziś', mark: 'due', tasks: [] },
      {
        key: 'later',
        label: 'Na spokojnie',
        mark: 'later',
        tasks: [task({ id: 'b' }), task({ id: 'c' })],
      },
    ]

    render(
      <TaskList
        sections={sections}
        today={TODAY}
        onDone={vi.fn()}
        onUndo={vi.fn()}
        onOpen={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Zaległe' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Na dziś' })).not.toBeInTheDocument()
    const later = screen.getByRole('heading', { name: 'Na spokojnie' }).parentElement
    expect(within(later).getByText('2')).toBeInTheDocument()
  })
})

describe('HeroCard', () => {
  it('states what is left as a sentence rather than a percentage', () => {
    const tasks = [
      task({ id: 'a', lastDone: '2026-07-18' }), // overdue
      task({ id: 'b', lastDone: '2026-07-21' }), // due
      task({ id: 'c', lastDone: '2026-07-21' }), // due
    ]
    render(<HeroCard tasks={tasks} today={TODAY} weekStats={null} />)
    expect(screen.getByText('Zostały dwie rzeczy i jedna zaległość.')).toBeInTheDocument()
  })

  it('names the last thing that left the list today', () => {
    const tasks = [
      task({
        id: 'a',
        name: 'Odkurzyć salon',
        lastDone: '2026-07-24',
        completedBy: { email: 'k@example.com', name: 'Kuba' },
      }),
    ]
    render(<HeroCard tasks={tasks} today={TODAY} weekStats={null} />)
    expect(screen.getByText(/Odkurzyć salon — Kuba/)).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('reads as a reward and points at what is coming next', () => {
    const next = task({
      interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-20' },
      lastDone: '2026-07-20',
    })
    render(<EmptyState tasks={[next]} today={TODAY} variant="today" />)
    expect(screen.getByText('Na dziś nic. Dom się sam ogarnął.')).toBeInTheDocument()
    expect(screen.getByText(/Najbliższa rzecz wypada za 3 dni: Podlać monsterę/)).toBeInTheDocument()
  })
})

describe('RhythmEditor', () => {
  function renderEditor(interval) {
    const onChange = vi.fn()
    render(
      <RhythmEditor
        value={interval}
        onChange={onChange}
        today={TODAY}
        lastDone={null}
        rebaseChoice={null}
        onRebase={vi.fn()}
      />
    )
    return onChange
  }

  it('previews the next three deadlines before anything is saved', () => {
    renderEditor({ type: 'everyNDays', n: 2, startsOn: '2026-07-24' })
    expect(screen.getByText('24 lipca')).toBeInTheDocument()
    expect(screen.getByText('26 lipca')).toBeInTheDocument()
    expect(screen.getByText('28 lipca')).toBeInTheDocument()
  })

  it('carries the anchor across a change of rhythm rather than dropping it', () => {
    const onChange = renderEditor({ type: 'everyNDays', n: 3, startsOn: '2026-07-03' })
    fireEvent.click(screen.getByRole('button', { name: 'co miesiąc' }))
    expect(onChange).toHaveBeenCalledWith({
      type: 'monthly',
      day: 'first',
      startsOn: '2026-07-03',
    })
  })

  it('seeds weekly with the anchor’s own weekday', () => {
    const onChange = renderEditor({ type: 'daily', startsOn: '2026-07-03' }) // a Friday
    fireEvent.click(screen.getByRole('button', { name: 'co tydzień' }))
    expect(onChange).toHaveBeenCalledWith({
      type: 'weekly',
      weekdays: [5],
      startsOn: '2026-07-03',
    })
  })

  it('drops the anchor entirely when switching to a rhythm that has none', () => {
    const onChange = renderEditor({ type: 'everyNDays', n: 3, startsOn: '2026-07-03' })
    fireEvent.click(screen.getByRole('button', { name: 'bez rytmu' }))
    expect(onChange).toHaveBeenCalledWith({ type: 'manual' })
  })

  it('shows no anchor and no preview for a manual rhythm', () => {
    renderEditor({ type: 'manual' })
    expect(screen.queryByText('Od kiedy liczymy?')).not.toBeInTheDocument()
    expect(screen.queryByText('Wypadnie')).not.toBeInTheDocument()
    expect(screen.getByText(/Nic samo nie wróci na listę/)).toBeInTheDocument()
  })

  it('toggles individual weekdays', () => {
    const onChange = renderEditor({ type: 'weekly', weekdays: [1], startsOn: '2026-07-03' })
    fireEvent.click(screen.getByRole('button', { name: 'czwartek' }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weekdays: [1, 4] }))
  })
})

describe('TaskSheet', () => {
  function renderSheet(props = {}) {
    const handlers = {
      onSave: vi.fn(),
      onClose: vi.fn(),
      onDelete: vi.fn(),
      onArchive: vi.fn(),
      onTogglePin: vi.fn(),
      onDone: vi.fn(),
    }
    render(<TaskSheet today={TODAY} {...handlers} {...props} />)
    return handlers
  }

  it('opens a new task pre-filled from the quick-add draft', () => {
    const { onSave } = renderSheet({ draft: { name: 'Wymienić filtr' } })
    expect(screen.getByDisplayValue('Wymienić filtr')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj do domu' }))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Wymienić filtr',
        category: 'home',
        interval: { type: 'everyNDays', n: 3, startsOn: '2026-07-24' },
      })
    )
  })

  it('refuses to save a task with no name', () => {
    const { onSave } = renderSheet({ draft: {} })
    const save = screen.getByRole('button', { name: 'Dodaj do domu' })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('only asks what to re-base on once the rhythm has actually changed', () => {
    const existing = task({ lastDone: '2026-07-21' })
    renderSheet({ task: existing })
    expect(screen.queryByText(/Zmiana rytmu przesunie/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'codziennie' }))
    expect(screen.getByText(/Zmiana rytmu przesunie/)).toBeInTheDocument()
  })

  it('moves the anchor to today when the user chooses to start over', () => {
    const { onSave } = renderSheet({ task: task({ lastDone: '2026-07-21' }) })

    fireEvent.click(screen.getByRole('button', { name: 'codziennie' }))
    fireEvent.click(screen.getByRole('button', { name: 'licz od dziś, zacznij na nowo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ interval: { type: 'daily', startsOn: '2026-07-24' } })
    )
  })

  it('offers completing an existing task, which the quiet card has no room for', () => {
    const { onDone } = renderSheet({ task: task({ lastDone: '2026-07-21' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Zrobione' }))
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })

  it('hides the complete action for something already done today', () => {
    renderSheet({ task: task({ lastDone: '2026-07-24' }) })
    expect(screen.queryByRole('button', { name: 'Zrobione' })).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { onClose } = renderSheet({ draft: {} })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
