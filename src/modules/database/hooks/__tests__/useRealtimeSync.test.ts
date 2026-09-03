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

  it('subscribes to and handles field-updated, field-created, field-deleted, and fields-reordered events', () => {
    const setRows = jest.fn()
    const setFields = jest.fn()
    const fetchTableData = jest.fn().mockResolvedValue(undefined)
    const addToast = jest.fn()

    const eventHandlers: Record<string, Function> = {}
    mockChannel.bind.mockImplementation((event: string, callback: Function) => {
      eventHandlers[event] = callback
    })

    renderHook(() =>
      useRealtimeSync({
        activeTableId: 1,
        setRows,
        setFields,
        fetchTableData,
        addToast,
      })
    )

    // Verify all field events are bound
    expect(mockChannel.bind).toHaveBeenCalledWith('field-updated', expect.any(Function))
    expect(mockChannel.bind).toHaveBeenCalledWith('field-created', expect.any(Function))
    expect(mockChannel.bind).toHaveBeenCalledWith('field-deleted', expect.any(Function))
    expect(mockChannel.bind).toHaveBeenCalledWith('fields-reordered', expect.any(Function))
    expect(mockChannel.bind).toHaveBeenCalledWith('rows-batch-changed', expect.any(Function))

    // 1. Test field-updated
    eventHandlers['field-updated']({
      field: { id: 10, name: '類別', options: { choices: [{ id: 'opt_123', name: '新選項' }] } },
    })
    expect(setFields).toHaveBeenCalled()
    const updateFn = setFields.mock.calls[0][0]
    const initialFields = [{ id: 10, name: '舊類別', options: {} }, { id: 11, name: '其他' }]
    expect(updateFn(initialFields)).toEqual([
      { id: 10, name: '類別', options: { choices: [{ id: 'opt_123', name: '新選項' }] } },
      { id: 11, name: '其他' },
    ])

    // 2. Test field-created
    eventHandlers['field-created']({
      field: { id: 12, name: '最新欄位', order: 2 },
    })
    const createFn = setFields.mock.calls[1][0]
    expect(createFn(initialFields)).toEqual([
      { id: 10, name: '舊類別', options: {} },
      { id: 11, name: '其他' },
      { id: 12, name: '最新欄位', order: 2 },
    ])

    // 3. Test field-deleted
    eventHandlers['field-deleted']({ fieldId: 10 })
    const deleteFn = setFields.mock.calls[2][0]
    expect(deleteFn(initialFields)).toEqual([
      { id: 11, name: '其他' },
    ])

    // 4. Test fields-reordered
    eventHandlers['fields-reordered']()
    expect(fetchTableData).toHaveBeenCalledWith(1)

    // 5. Test rows-batch-changed
    eventHandlers['rows-batch-changed']()
    expect(fetchTableData).toHaveBeenCalledWith(1)
  })
})
