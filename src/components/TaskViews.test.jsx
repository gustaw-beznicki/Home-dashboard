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
      unit: 'month',
      every: 1,
      day: 'first',
      startsOn: '2026-07-03',
    })
  })

  it('builds a yearly rhythm with no day rule, since the anchor holds the date', () => {
    const onChange = renderEditor({ type: 'monthly', unit: 'month', every: 3, day: 15, startsOn: '2026-03-12' })
    fireEvent.click(screen.getByRole('button', { name: 'co rok' }))
    // `every` resets rather than carrying across: "co 3 miesiące" turning into
    // "co 3 lata" on one tap would be a nasty surprise.
    expect(onChange).toHaveBeenCalledWith({
      type: 'monthly',
      unit: 'year',
      every: 1,
      startsOn: '2026-03-12',
    })
  })

  it('lights the yearly chip for a stored yearly rhythm, not the monthly one', () => {
    renderEditor({ type: 'monthly', unit: 'year', every: 2, startsOn: '2026-03-12' })
    expect(screen.getByRole('button', { name: 'co rok' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'co miesiąc' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('hides the day rules under a yearly rhythm and says why', () => {
    renderEditor({ type: 'monthly', unit: 'year', every: 2, startsOn: '2026-03-12' })
    expect(screen.queryByText('pierwszego dnia')).not.toBeInTheDocument()
    expect(screen.queryByText('ostatniego dnia')).not.toBeInTheDocument()
    expect(screen.getByText('Dzień i miesiąc bierzemy z daty poniżej.')).toBeInTheDocument()
  })

  it('keeps the day rules under a monthly rhythm', () => {
    renderEditor({ type: 'monthly', unit: 'month', every: 1, day: 'first', startsOn: '2026-03-12' })
    expect(screen.getByText('pierwszego dnia')).toBeInTheDocument()
    expect(screen.queryByText('Dzień i miesiąc bierzemy z daty poniżej.')).not.toBeInTheDocument()
  })

  it('offers year cadences under years and month cadences under months', () => {
    const { unmount } = render(
      <RhythmEditor
        value={{ type: 'monthly', unit: 'year', every: 1, startsOn: '2026-03-12' }}
        onChange={vi.fn()}
        today={TODAY}
        lastDone={null}
        rebaseChoice={null}
        onRebase={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '2 lata' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'kwartał' })).not.toBeInTheDocument()
    unmount()

    renderEditor({ type: 'monthly', unit: 'month', every: 1, day: 1, startsOn: '2026-03-12' })
    expect(screen.getByRole('button', { name: 'kwartał' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2 lata' })).not.toBeInTheDocument()
  })

  it('sets the cadence without disturbing the day rule', () => {
    const onChange = renderEditor({ type: 'monthly', unit: 'month', every: 1, day: 15, startsOn: '2026-03-12' })
    fireEvent.click(screen.getByRole('button', { name: 'kwartał' }))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ every: 3, unit: 'month', day: 15 })
    )
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

  it('says so when the weekday list has been emptied, rather than falling back silently', () => {
    renderEditor({ type: 'weekly', weekdays: [], startsOn: '2026-07-03' })
    expect(screen.getByText('Zaznacz przynajmniej jeden dzień.')).toBeInTheDocument()
  })

  it('keeps the weekday hint out of the way while a day is selected', () => {
    renderEditor({ type: 'weekly', weekdays: [1], startsOn: '2026-07-03' })
    expect(screen.queryByText('Zaznacz przynajmniej jeden dzień.')).not.toBeInTheDocument()
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
    // A fresh task starts from the household's default rhythm — 'weekly'
    // unless Panel domu says otherwise — anchored on today (a Friday, ISO 5).
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Wymienić filtr',
        category: 'home',
        interval: { type: 'weekly', weekdays: [5], startsOn: '2026-07-24' },
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

  it('says why the save button is dead instead of leaving it greyed out unexplained', () => {
    renderSheet({ draft: {} })
    expect(screen.getByText('Wpisz nazwę, żeby zapisać.')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Co trzeba ogarnąć?'), {
      target: { value: 'Wymienić filtr' },
    })
    expect(screen.queryByText('Wpisz nazwę, żeby zapisać.')).not.toBeInTheDocument()
  })

  it('marks the two fields that may be left empty, and nothing else', () => {
    renderSheet({ draft: { name: 'Wymienić filtr' } })
    const optional = screen.getAllByText('opcjonalne')
    expect(optional).toHaveLength(2)
    expect(screen.getByLabelText(/Ostatnio zrobione/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Notatka/)).toBeInTheDocument()
  })

  it('blocks saving a weekly task with no weekday selected', () => {
    const { onSave } = renderSheet({ draft: { name: 'Wymienić filtr' } })
    // The default rhythm is weekly, seeded with today's weekday — untick it.
    fireEvent.click(screen.getByRole('button', { name: 'piątek' }))

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

describe('RhythmEditor preview across years', () => {
  function renderYears(interval) {
    render(
      <RhythmEditor
        value={interval}
        onChange={vi.fn()}
        today={TODAY}
        lastDone={null}
        rebaseChoice={null}
        onRebase={vi.fn()}
      />
    )
  }

  it('stamps the year on deadlines outside the current one', () => {
    // Without the year these three read "27 lipca · 27 lipca · 27 lipca": correct
    // dates two years apart, rendered identically, so the preview looked broken.
    renderYears({ type: 'monthly', unit: 'year', every: 2, startsOn: '2026-07-27' })
    expect(screen.getByText('27 lipca')).toBeInTheDocument()
    expect(screen.getByText('27 lipca 2028')).toBeInTheDocument()
    expect(screen.getByText('27 lipca 2030')).toBeInTheDocument()
  })

  it('leaves the year off dates inside the current one', () => {
    renderYears({ type: 'everyNDays', n: 2, startsOn: '2026-07-24' })
    expect(screen.getByText('24 lipca')).toBeInTheDocument()
    expect(screen.queryByText('24 lipca 2026')).not.toBeInTheDocument()
  })
})

describe('RhythmEditor nth-weekday pickers', () => {
  function renderNth(interval) {
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

  const monthly = (day) => ({ type: 'monthly', unit: 'month', every: 1, day, startsOn: '2026-07-01' })

  it('no longer claims the rule is the first Saturday', () => {
    renderNth(monthly('first'))
    // The old label was a promise the stored rule could not break, because it
    // was hardcoded. Now it describes a choice.
    expect(screen.queryByText('w pierwszą sobotę')).not.toBeInTheDocument()
    expect(screen.getByText('w dany dzień tygodnia')).toBeInTheDocument()
  })

  it('shows the pickers only once the nth rule is the selected one', () => {
    const onChange = renderNth(monthly('first'))
    expect(screen.queryByLabelText('Która z kolei')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('w dany dzień tygodnia'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ day: { nth: 1, weekday: 6 } }))
  })

  it('reflects the stored rule in both pickers', () => {
    renderNth(monthly({ nth: 3, weekday: 3 }))
    expect(screen.getByLabelText('Która z kolei')).toHaveValue('3')
    expect(screen.getByLabelText('Dzień tygodnia')).toHaveValue('3')
  })

  it('changes one field without disturbing the other', () => {
    const onChange = renderNth(monthly({ nth: 1, weekday: 6 }))

    fireEvent.change(screen.getByLabelText('Która z kolei'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ day: { nth: 3, weekday: 6 } }))

    fireEvent.change(screen.getByLabelText('Dzień tygodnia'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ day: { nth: 1, weekday: 2 } }))
  })

  it('describes the chosen rule in the preview, in the accusative', () => {
    renderNth(monthly({ nth: 3, weekday: 3 }))
    expect(screen.getByText('co miesiąc, w trzecią środę')).toBeInTheDocument()
  })

  it('offers only the four ordinals a month reliably has', () => {
    renderNth(monthly({ nth: 1, weekday: 6 }))
    const options = screen.getByLabelText('Która z kolei').querySelectorAll('option')
    // A fifth Saturday is missing from most months, so it is not offered.
    expect([...options].map((o) => o.textContent)).toEqual([
      'pierwszą',
      'drugą',
      'trzecią',
      'czwartą',
    ])
  })
})

describe('RhythmEditor February warning', () => {
  function renderDay(day) {
    render(
      <RhythmEditor
        value={{ type: 'monthly', unit: 'month', every: 1, day, startsOn: '2026-07-01' }}
        onChange={vi.fn()}
        today={TODAY}
        lastDone={null}
        rebaseChoice={null}
        onRebase={vi.fn()}
      />
    )
  }

  it('warns about February only under the last-day rule', () => {
    renderDay('last')
    expect(screen.getByText(/W lutym „ostatni dzień”/)).toBeInTheDocument()
  })

  it.each([['first', 'first'], ['a day number', 15], ['an nth weekday', { nth: 1, weekday: 6 }]])(
    'stays quiet under %s, which has no February problem',
    (_label, day) => {
      renderDay(day)
      expect(screen.queryByText(/W lutym „ostatni dzień”/)).not.toBeInTheDocument()
    }
  )
})
