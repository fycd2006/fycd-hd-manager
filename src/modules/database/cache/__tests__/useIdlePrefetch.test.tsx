/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'
import { useIdlePrefetch } from '../useIdlePrefetch'
import { pushRecentTable } from '../recentTables'

const ALL = [1, 2, 3, 4, 5]

function seed() {
  for (const id of ALL) pushRecentTable(1, id) // 最近清單 [5,4,3,2,1]
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
  delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback
  delete (navigator as unknown as { connection?: unknown }).connection
  seed()
})
afterEach(() => {
  jest.useRealTimers()
  delete (navigator as unknown as { connection?: unknown }).connection
})

describe('useIdlePrefetch', () => {
  it('prefetches up to 3 recent tables excluding active, one per idle tick', async () => {
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
    )
    expect(prefetch).not.toHaveBeenCalled()
    await act(async () => { await jest.advanceTimersByTimeAsync(1500) })
    expect(prefetch.mock.calls).toEqual([[5]])
    await act(async () => { await jest.advanceTimersByTimeAsync(1500) })
    expect(prefetch.mock.calls).toEqual([[5], [3]])
    await act(async () => { await jest.advanceTimersByTimeAsync(1500) })
    expect(prefetch.mock.calls).toEqual([[5], [3], [2]])
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch).toHaveBeenCalledTimes(3)
  })

  it('prefetches all 3 even when idle callbacks fire faster than loads', async () => {
    let active = 0
    let maxActive = 0
    const prefetch = jest.fn(() => {
      active++
      maxActive = Math.max(maxActive, active)
      return new Promise<void>(resolve => setTimeout(() => { active--; resolve() }, 5000))
    })
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(3000) })
    // The first load is still running: the next one waits for it
    expect(prefetch.mock.calls).toEqual([[5]])
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) })
    expect(prefetch.mock.calls).toEqual([[5], [3], [2]])
    expect(maxActive).toBe(1)
  })

  it('does not schedule the next table after unmount while a load is running', async () => {
    const prefetch = jest.fn(() => new Promise<void>(resolve => setTimeout(resolve, 5000)))
    const { unmount } = renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(1500) })
    expect(prefetch).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => { await jest.advanceTimersByTimeAsync(30000) })
    expect(prefetch).toHaveBeenCalledTimes(1)
  })

  it('uses requestIdleCallback when available', async () => {
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const requestIdle = jest.fn((cb: () => void) => setTimeout(cb, 50) as unknown as number)
    const cancelIdle = jest.fn((handle: number) => clearTimeout(handle))
    w.requestIdleCallback = requestIdle
    w.cancelIdleCallback = cancelIdle
    try {
      const prefetch = jest.fn(() => Promise.resolve())
      renderHook(() =>
        useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
      )
      await act(async () => { await jest.advanceTimersByTimeAsync(50) })
      expect(prefetch.mock.calls).toEqual([[5]])
      await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
      expect(prefetch.mock.calls).toEqual([[5], [3], [2]])
      expect(requestIdle).toHaveBeenCalledTimes(3)

      // Unmounting with an idle callback pending cancels it
      const { unmount } = renderHook(() =>
        useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
      )
      unmount()
      expect(cancelIdle).toHaveBeenCalled()
      await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
      expect(prefetch).toHaveBeenCalledTimes(3)
    } finally {
      delete w.requestIdleCallback
      delete w.cancelIdleCallback
    }
  })

  it('skips tables not in validTableIds', async () => {
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: [4, 2, 1], prefetch })
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch.mock.calls).toEqual([[4], [2], [1]])
  })

  it('disabled when saveData', async () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: ALL, prefetch })
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('cancels on unmount', async () => {
    const prefetch = jest.fn()
    const { unmount } = renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: ALL, prefetch })
    )
    unmount()
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('waits until validTableIds is non-empty', async () => {
    const prefetch = jest.fn()
    const { rerender } = renderHook(
      ({ ids }: { ids: number[] }) =>
        useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: ids, prefetch }),
      { initialProps: { ids: [] as number[] } }
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(5000) })
    expect(prefetch).not.toHaveBeenCalled()
    rerender({ ids: ALL })
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch.mock.calls).toEqual([[5], [4], [3]])
  })

  it('cancels pending prefetch when workspaceId changes', async () => {
    pushRecentTable(2, 20)
    const prefetch = jest.fn()
    const { rerender } = renderHook(
      ({ ws }: { ws: number }) =>
        useIdlePrefetch({ workspaceId: ws, activeTableId: null, validTableIds: [...ALL, 20], prefetch }),
      { initialProps: { ws: 1 } }
    )
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    rerender({ ws: 2 })
    await act(async () => { await jest.advanceTimersByTimeAsync(10000) })
    expect(prefetch.mock.calls).toEqual([[20]])
  })
})
