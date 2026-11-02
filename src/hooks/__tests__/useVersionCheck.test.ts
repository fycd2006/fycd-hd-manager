/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'
import { useVersionCheck } from '../useVersionCheck'
import { APP_CURRENT_VERSION, CHANGELOG_RELEASES } from '@/config/changelog'

describe('useVersionCheck', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch
  })

  it('initializes with current version and detects no update when version matches', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: APP_CURRENT_VERSION,
        latestRelease: CHANGELOG_RELEASES[0],
        history: CHANGELOG_RELEASES,
      }),
    })

    const { result } = renderHook(() => useVersionCheck({ checkIntervalMs: 60000 }))

    expect(result.current.currentVersion).toBe(APP_CURRENT_VERSION)
    expect(result.current.hasUpdate).toBe(false)

    // Advance macro-task timeout for initial check
    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/version', expect.any(Object))
    expect(result.current.hasUpdate).toBe(false)
  })

  it('detects new version when remote version is different', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v1.2.0',
        latestRelease: {
          version: 'v1.2.0',
          releaseDate: '2026-11-03',
          title: 'New Feature Release',
          items: [{ type: 'feature', text: 'Brand new feature' }],
        },
        history: [],
      }),
    })

    const { result } = renderHook(() => useVersionCheck({ checkIntervalMs: 60000 }))

    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    expect(result.current.hasUpdate).toBe(true)
    expect(result.current.latestVersion).toBe('v1.2.0')
    expect(result.current.latestRelease?.title).toBe('New Feature Release')
  })

  it('polls periodically based on checkIntervalMs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: APP_CURRENT_VERSION,
        latestRelease: CHANGELOG_RELEASES[0],
        history: CHANGELOG_RELEASES,
      }),
    })

    renderHook(() => useVersionCheck({ checkIntervalMs: 10000 }))

    // Initial check
    await act(async () => {
      jest.advanceTimersByTime(10)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Fast-forward interval
    await act(async () => {
      jest.advanceTimersByTime(10000)
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('triggers update check when window visibility changes to visible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: APP_CURRENT_VERSION,
        latestRelease: CHANGELOG_RELEASES[0],
        history: CHANGELOG_RELEASES,
      }),
    })

    renderHook(() => useVersionCheck({ checkIntervalMs: 60000 }))

    await act(async () => {
      jest.advanceTimersByTime(10)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Simulate tab switch back
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })

    await act(async () => {
      // Advance by 6000ms so debounce/throttle does not block
      jest.advanceTimersByTime(6000)
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('supports dismissing update notification and reloading on applyUpdate', async () => {
    const reloadMock = jest.fn()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v2.0.0',
        latestRelease: { version: 'v2.0.0', releaseDate: '2026-11-03', items: [] },
        history: [],
      }),
    })

    const { result } = renderHook(() => useVersionCheck({ reloadFn: reloadMock }))

    await act(async () => {
      jest.advanceTimersByTime(10)
    })

    expect(result.current.hasUpdate).toBe(true)
    expect(result.current.isDismissed).toBe(false)

    act(() => {
      result.current.dismissUpdateNotification()
    })

    expect(result.current.isDismissed).toBe(true)

    act(() => {
      result.current.applyUpdate()
    })

    expect(reloadMock).toHaveBeenCalled()
  })
})
