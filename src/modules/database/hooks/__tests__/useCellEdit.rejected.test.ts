/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useCellEdit } from '../useCellEdit'
import * as rowService from '@/modules/database/services/row'
import type { TableField, TableRow } from '@/modules/database/types'

jest.mock('@/modules/database/services/row')

const fields: TableField[] = [
  { id: 1, tableId: 1, name: '數量', type: 'number', order: 0, width: 150, options: null },
  { id: 2, tableId: 1, name: '標題', type: 'text', order: 1, width: 150, options: null },
]

const makeRows = (): TableRow[] => [
  { id: 101, tableId: 1, order: 1, data: { field_1: 5, field_2: 'a' }, createdAt: '', updatedAt: '' },
  { id: 102, tableId: 1, order: 2, data: { field_1: 6, field_2: 'b' }, createdAt: '', updatedAt: '' },
]

function setup() {
  let rowsState = makeRows()
  const setRows = jest.fn((p: TableRow[] | ((prev: TableRow[]) => TableRow[])) => {
    rowsState = typeof p === 'function' ? p(rowsState) : p
  })
  const pushEdit = jest.fn()
  const addToast = jest.fn()
  const hook = renderHook(() =>
    useCellEdit({ activeTableId: 1, rows: rowsState, setRows, fields, pushEdit, addToast })
  )
  return { hook, getRows: () => rowsState, pushEdit, addToast }
}

describe('useCellEdit - rejected cells in batch update', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  const updates = [
    { rowId: 101, data: { field_1: 'abc', field_2: 'x' } },
    { rowId: 102, data: { field_1: 'zzz', field_2: 'y' } },
  ]

  it('toasts rejected summary, reverts rejected cells and excludes them from undo history', async () => {
    const { hook, getRows, pushEdit, addToast } = setup()
    ;(rowService.batchUpdateRows as jest.Mock).mockResolvedValue({
      ok: true,
      updates: [
        { rowId: 101, data: { field_2: 'x' } },
        { rowId: 102, data: { field_2: 'y' } },
      ],
      rejected: [
        { rowId: 101, fieldId: 1, code: 'invalid_number', reason: '必須是有效的數字' },
        { rowId: 102, fieldId: 1, code: 'invalid_number', reason: '必須是有效的數字' },
      ],
    })

    await act(async () => {
      await hook.result.current.batchUpdateCells(updates)
    })

    expect(addToast).toHaveBeenCalledWith('已寫入 2 格，2 格未寫入：數量 必須是有效的數字', 'info')
    const rows = getRows()
    expect(rows[0].data.field_1).toBe(5)
    expect(rows[1].data.field_1).toBe(6)
    expect(rows[0].data.field_2).toBe('x')
    const edits = pushEdit.mock.calls[0][0].edits
    expect(edits).toHaveLength(2)
    expect(edits.every((e: { fieldKey: string }) => e.fieldKey === 'field_2')).toBe(true)
  })

  it('marks rejected cells in recentlyRejected and clears after 3 seconds', async () => {
    const { hook } = setup()
    ;(rowService.batchUpdateRows as jest.Mock).mockResolvedValue({
      ok: true,
      updates: [{ rowId: 102, data: { field_2: 'y' } }],
      rejected: [{ rowId: 101, fieldId: 1, code: 'invalid_number', reason: '必須是有效的數字' }],
    })
    expect(hook.result.current.recentlyRejected.size).toBe(0)

    await act(async () => {
      await hook.result.current.batchUpdateCells(updates)
    })
    expect(hook.result.current.recentlyRejected.has('101:1')).toBe(true)

    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(hook.result.current.recentlyRejected.size).toBe(0)
  })

  it('shows no extra toast when nothing is rejected', async () => {
    const { hook, addToast } = setup()
    ;(rowService.batchUpdateRows as jest.Mock).mockResolvedValue({
      ok: true,
      updates: [{ rowId: 101, data: {} }],
      rejected: [],
    })
    await act(async () => {
      await hook.result.current.batchUpdateCells(updates)
    })
    expect(addToast).not.toHaveBeenCalled()
    expect(hook.result.current.recentlyRejected.size).toBe(0)
  })

  it('falls back to 欄位 <id> when field is unknown', async () => {
    const { hook, addToast } = setup()
    ;(rowService.batchUpdateRows as jest.Mock).mockResolvedValue({
      ok: true,
      updates: [],
      rejected: [{ rowId: 101, fieldId: 99, code: 'invalid_number', reason: '無效' }],
    })
    await act(async () => {
      await hook.result.current.batchUpdateCells([{ rowId: 101, data: { field_99: 'q' } }])
    })
    expect(addToast).toHaveBeenCalledWith('已寫入 0 格，1 格未寫入：欄位 99 無效', 'info')
  })
})
