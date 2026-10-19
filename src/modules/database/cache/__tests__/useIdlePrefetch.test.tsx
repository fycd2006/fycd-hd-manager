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
  it('prefetches up to 3 recent tables excluding active, one per idle tick', () => {
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: 4, validTableIds: ALL, prefetch })
    )
    expect(prefetch).not.toHaveBeenCalled()
    act(() => { jest.advanceTimersByTime(1500) })
    expect(prefetch.mock.calls).toEqual([[5]])
    act(() => { jest.advanceTimersByTime(1500) })
    expect(prefetch.mock.calls).toEqual([[5], [3]])
    act(() => { jest.advanceTimersByTime(1500) })
    expect(prefetch.mock.calls).toEqual([[5], [3], [2]])
    act(() => { jest.advanceTimersByTime(10000) })
    expect(prefetch).toHaveBeenCalledTimes(3)
  })

  it('skips tables not in validTableIds', () => {
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: [4, 2, 1], prefetch })
    )
    act(() => { jest.advanceTimersByTime(10000) })
    expect(prefetch.mock.calls).toEqual([[4], [2], [1]])
  })

  it('disabled when saveData', () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true })
    const prefetch = jest.fn()
    renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: ALL, prefetch })
    )
    act(() => { jest.advanceTimersByTime(10000) })
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('cancels on unmount', () => {
    const prefetch = jest.fn()
    const { unmount } = renderHook(() =>
      useIdlePrefetch({ workspaceId: 1, activeTableId: null, validTableIds: ALL, prefetch })
    )
    unmount()
    act(() => { jest.advanceTimersByTime(10000) })
    expect(prefetch).not.toHaveBeenCalled()
  })
})
