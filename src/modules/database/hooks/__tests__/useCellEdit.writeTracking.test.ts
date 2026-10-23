/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useCellEdit } from '../useCellEdit'
import * as rowService from '@/modules/database/services/row'
import { localWriteTracker, __resetLocalWriteTrackerForTests } from '@/modules/database/cache/localWriteTracker'
import type { TableField, TableRow } from '@/modules/database/types'

jest.mock('@/modules/database/services/row')

const fields: TableField[] = [
  { id: 1, tableId: 1, name: 'Title', type: 'text', order: 0, width: 150, options: null },
]
const rows: TableRow[] = [
  { id: 101, tableId: 1, order: 1000, data: { field_1: 'a' }, createdAt: '', updatedAt: '' },
]

describe('useCellEdit local write tracking', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    __resetLocalWriteTrackerForTests()
  })
  afterEach(() => jest.useRealTimers())

  function setup() {
    return renderHook(() =>
      useCellEdit({ activeTableId: 1, rows, setRows: jest.fn(), fields, pushEdit: jest.fn(), addToast: jest.fn() })
    )
  }

  it('counts the debounce window as a local write until the request settles', async () => {
    ;(rowService.updateCell as jest.Mock).mockResolvedValue({ ok: true })
    const { result } = setup()

    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'b')
    })
    expect(localWriteTracker.inFlight()).toBe(1)

    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(rowService.updateCell).toHaveBeenCalled()
    expect(localWriteTracker.inFlight()).toBe(0)
  })

  it('rapid typing on one cell keeps a single write in flight', async () => {
    ;(rowService.updateCell as jest.Mock).mockResolvedValue({ ok: true })
    const { result } = setup()

    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'b')
      await result.current.updateCell(101, 'field_1', 'bc')
    })
    expect(localWriteTracker.inFlight()).toBe(1)

    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(rowService.updateCell).toHaveBeenCalledTimes(1)
    expect(localWriteTracker.inFlight()).toBe(0)
  })

  it('ends pending writes when the hook unmounts before the debounce fires', async () => {
    const { result, unmount } = setup()
    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'b')
    })
    unmount()
    expect(localWriteTracker.inFlight()).toBe(0)
  })
})
