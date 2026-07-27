import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasks } from './useTasks'

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const baseTask = {
  id: '1',
  name: 'Water plant',
  lastDone: null,
  interval: { type: 'daily' },
  priority: 'medium',
  note: '',
  category: 'plants',
  pinned: false,
  archived: false,
  completedBy: null,
}

describe('useTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads tasks on mount', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse([baseTask]))

    const { result } = renderHook(() => useTasks())

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tasks).toEqual([baseTask])
    expect(global.fetch).toHaveBeenCalledWith('/api/tasks')
  })

  it('optimistically marks a task done, then merges the server response (attribution)', async () => {
    const completed = {
      ...baseTask,
      lastDone: '2026-07-25',
      completedBy: { email: 'a@example.com', name: 'Alice' },
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([baseTask]))
      .mockResolvedValueOnce(jsonResponse(completed))

    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.markDone('1', new Date(2026, 6, 25))
    })

    // Optimistic update is visible before the network call resolves.
    expect(result.current.tasks[0].lastDone).toBe('2026-07-25')

    await waitFor(() =>
      expect(result.current.tasks[0].completedBy).toEqual(completed.completedBy)
    )
  })

  it('rolls back an optimistic edit if the API call fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([baseTask]))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))

    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.editTask('1', { name: 'Water plant twice' })
    })

    expect(result.current.tasks[0].name).toBe('Water plant twice')

    await waitFor(() => expect(result.current.tasks[0].name).toBe('Water plant'))
    await waitFor(() => expect(result.current.error).not.toBeNull())
  })

  it('remembers a failed write so it can be fired again, not merely refetched', async () => {
    const completed = { ...baseTask, lastDone: '2026-07-25' }
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([baseTask])) // GET /api/tasks
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500)) // the tick, failing
      .mockResolvedValueOnce(jsonResponse(completed)) // the same tick, retried

    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.markDone('1', new Date(2026, 6, 25))
    })

    // The banner needs to name the thing, and the name has to survive the
    // rollback that just wiped the optimistic state.
    await waitFor(() => expect(result.current.rollback).not.toBeNull())
    expect(result.current.rollback.name).toBe('Water plant')
    expect(result.current.tasks[0].lastDone).toBeNull()

    act(() => {
      result.current.rollback.retry()
    })

    await waitFor(() => expect(result.current.tasks[0].lastDone).toBe('2026-07-25'))
    expect(result.current.rollback).toBeNull()
    expect(result.current.error).toBeNull()

    // Three calls, and the third is the completion again — not a list refetch.
    expect(global.fetch).toHaveBeenCalledTimes(3)
    expect(global.fetch.mock.calls[2][0]).toBe('/api/tasks/1/complete')
    expect(global.fetch.mock.calls[2][1].method).toBe('POST')
  })

  it('clears a remembered failure once any write succeeds', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([baseTask]))
      .mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse({ ...baseTask, pinned: true }))

    const { result } = renderHook(() => useTasks())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.editTask('1', { name: 'Water plant twice' })
    })
    await waitFor(() => expect(result.current.rollback).not.toBeNull())

    act(() => {
      result.current.togglePin('1')
    })
    await waitFor(() => expect(result.current.rollback).toBeNull())
  })
})
