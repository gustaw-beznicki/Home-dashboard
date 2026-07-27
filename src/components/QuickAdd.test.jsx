import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QuickAdd } from './QuickAdd'

const TODAY = new Date(2026, 6, 24) // Friday 2026-07-24

// useCategories falls back to the built-in CATEGORIES when /api/categories is
// unreachable, which is what happens under jsdom — so 'plants' is a known key
// here without any stubbing.

// The catalog is imported lazily on first focus, so every test has to let that
// chunk land before asserting on suggestions — hence the warm-up here.
async function renderQuickAdd() {
  const onDraft = vi.fn()
  render(<QuickAdd today={TODAY} onDraft={onDraft} />)
  const input = screen.getByRole('combobox')

  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: 'smieci' } })
  await screen.findByRole('option', { name: /Wynieść śmieci/ })
  fireEvent.change(input, { target: { value: '' } })

  return { onDraft, input }
}

describe('QuickAdd suggestions', () => {
  it('loads the catalog only once the field is touched', () => {
    const onDraft = vi.fn()
    render(<QuickAdd today={TODAY} onDraft={onDraft} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('stays quiet until the query is worth matching', async () => {
    const { input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'p' } })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })

  it('offers matching chores with the rhythm they would prefill', async () => {
    const { input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'smieci' } })

    const option = screen.getByRole('option', { name: /Wynieść śmieci/ })
    expect(option).toHaveTextContent('co 2 dni')
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('hands the sheet a full draft anchored on today when a suggestion is picked', async () => {
    const { onDraft, input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'monster' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: /Podlać monsterę/ }))

    expect(onDraft).toHaveBeenCalledWith({
      name: 'Podlać monsterę',
      category: 'plants',
      interval: { type: 'everyNDays', n: 7, startsOn: '2026-07-24' },
    })
  })

  it('picks the highlighted suggestion with the keyboard', async () => {
    const { onDraft, input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'monster' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(input).toHaveAttribute('aria-activedescendant', 'quick-add-suggestion-water-monstera')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onDraft).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Podlać monsterę', category: 'plants' })
    )
  })

  it('still submits free text when nothing is highlighted', async () => {
    const { onDraft, input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'oddać rower do serwisu' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onDraft).toHaveBeenCalledWith({ name: 'oddać rower do serwisu' })
  })

  it('submits free text even when the query happens to match a chore', async () => {
    // Enter with no active option must keep meaning what it always meant,
    // otherwise the suggestion list quietly hijacks the plain path.
    const { onDraft, input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'smieci z piwnicy' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onDraft).toHaveBeenCalledWith({ name: 'smieci z piwnicy' })
  })

  it('closes the list on Escape without clearing what was typed', async () => {
    const { input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'smieci' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(input).toHaveValue('smieci')
  })

  it('drops a stale highlight when the query changes', async () => {
    const { onDraft, input } = await renderQuickAdd()
    fireEvent.change(input, { target: { value: 'monster' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.change(input, { target: { value: 'monstery pod oknem' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onDraft).toHaveBeenCalledWith({ name: 'monstery pod oknem' })
  })

  it('opens the empty sheet from the button when the field is empty', async () => {
    const { onDraft } = await renderQuickAdd()
    fireEvent.click(screen.getByRole('button', { name: 'Nowa rzecz' }))
    expect(onDraft).toHaveBeenCalledWith({})
  })
})
