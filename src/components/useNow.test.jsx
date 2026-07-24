import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './Dashboard'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances after the periodic tick interval, catching a day rollover while the tab stays open', () => {
    vi.setSystemTime(new Date(2026, 6, 24, 23, 59, 30))
    const { result } = renderHook(() => useNow())
    const before = result.current

    act(() => {
      vi.setSystemTime(new Date(2026, 6, 25, 0, 0, 30))
      vi.advanceTimersByTime(60_000)
    })

    expect(result.current.getTime()).toBeGreaterThan(before.getTime())
    expect(result.current.getDate()).toBe(25)
  })

  it('re-checks on visibilitychange, catching a backgrounded/locked tab reopened after midnight', () => {
    vi.setSystemTime(new Date(2026, 6, 24, 23, 59))
    const { result } = renderHook(() => useNow())

    act(() => {
      vi.setSystemTime(new Date(2026, 6, 25, 8, 0))
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.getDate()).toBe(25)
  })
})
