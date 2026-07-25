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
})
