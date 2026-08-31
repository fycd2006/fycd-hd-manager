/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react'
import { useRealtimeSync } from '../useRealtimeSync'
import { getPusherClient } from '@/lib/pusher-client'

const mockBind = jest.fn()
const mockUnbind = jest.fn()
const mockSubscribe = jest.fn()
const mockUnsubscribe = jest.fn()
const mockChannel = {
  bind: jest.fn(),
  unbind_all: jest.fn(),
}

jest.mock('@/lib/pusher-client', () => ({
  getPusherClient: jest.fn(),
}))

describe('useRealtimeSync - Pusher Connection Listener Leak Reproduction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSubscribe.mockReturnValue(mockChannel)

    const mockPusherInstance = {
      connection: {
        bind: mockBind,
        unbind: mockUnbind,
      },
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
    } as any

    ;(getPusherClient as jest.Mock).mockReturnValue(mockPusherInstance)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('reproduces bug: state_change listener on pusher.connection is NOT unbound on cleanup when table switches or unmounts', () => {
    const setRows = jest.fn()
    const fetchTableData = jest.fn().mockResolvedValue(undefined)
    const addToast = jest.fn()

    // 1. Initial mount with activeTableId = 1
    const { unmount, rerender } = renderHook(
      ({ activeTableId }) =>
        useRealtimeSync({
          activeTableId,
          setRows,
          fetchTableData,
          addToast,
        }),
      { initialProps: { activeTableId: 1 } }
    )

    // Pusher bound state_change once
    expect(mockBind).toHaveBeenCalledWith('state_change', expect.any(Function))
    expect(mockBind).toHaveBeenCalledTimes(1)

    // 2. Switch to tableId = 2 (triggers cleanup for table 1, then mounts table 2)
    rerender({ activeTableId: 2 })

    // Channel was cleaned up
    expect(mockChannel.unbind_all).toHaveBeenCalled()
    expect(mockUnsubscribe).toHaveBeenCalledWith('table-1')

    // 3. Unmount hook completely
    unmount()

    // VERIFICATION: pusher.connection.unbind('state_change', handleStateChange) should match bind calls
    // BUG IN CURRENT CODE: mockUnbind is NEVER called (mockUnbind.mock.calls.length === 0), leaking listener!
    expect(mockUnbind).toHaveBeenCalledWith('state_change', expect.any(Function))
    expect(mockUnbind).toHaveBeenCalledTimes(2) // 1 for table switch cleanup + 1 for unmount
  })
})
