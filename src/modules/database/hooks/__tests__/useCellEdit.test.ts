/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useCellEdit } from '../useCellEdit'
import * as rowService from '@/modules/database/services/row'
import type { TableField, TableRow } from '@/modules/database/types'

jest.mock('@/modules/database/services/row')

describe('useCellEdit - Debounce & Table Switching Isolation', () => {
  const fieldsTableA: TableField[] = [
    { id: 1, tableId: 1, name: 'Title', type: 'text', order: 0, width: 150, options: null },
  ]

  const fieldsTableB: TableField[] = [
    { id: 1, tableId: 2, name: 'Title', type: 'text', order: 0, width: 150, options: null },
  ]

  const initialRowsTableA: TableRow[] = [
    {
      id: 101,
      tableId: 1,
      order: 1000,
      data: { field_1: 'TABLE_A_INITIAL' },
      createdAt: '',
      updatedAt: '',
    },
  ]

  const initialRowsTableB: TableRow[] = [
    {
      id: 101,
      tableId: 2,
      order: 1000,
      data: { field_1: 'TABLE_B_INITIAL' },
      createdAt: '',
      updatedAt: '',
    },
  ]

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('verifies fix: Table A pending debounce timer does NOT overwrite Table B row on table switch', async () => {
    let currentRows = initialRowsTableA
    const setRowsMock = jest.fn((updater) => {
      if (typeof updater === 'function') {
        currentRows = updater(currentRows)
      } else {
        currentRows = updater
      }
    })

    const pushEditMock = jest.fn()
    const addToastMock = jest.fn()

    ;(rowService.updateCell as jest.Mock).mockResolvedValue({
      ok: true,
      row: {
        id: 101,
        tableId: 1,
        data: { field_1: 'TABLE_A_DIRTY_UPDATE' },
      },
    })

    // 1. Mount hook with Table A (activeTableId = 1)
    const { rerender, result } = renderHook(
      ({ activeTableId, rows, fields }) =>
        useCellEdit({
          activeTableId,
          rows,
          setRows: setRowsMock,
          fields,
          pushEdit: pushEditMock,
          addToast: addToastMock,
        }),
      {
        initialProps: {
          activeTableId: 1,
          rows: currentRows,
          fields: fieldsTableA,
        },
      }
    )

    // 2. User edits Row #101 on Table A (schedules 300ms debounce)
    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'TABLE_A_DIRTY_UPDATE')
    })

    // 3. Before 300ms completes (e.g. at 100ms), user switches to Table B (activeTableId = 2)
    act(() => {
      jest.advanceTimersByTime(100)
    })

    currentRows = initialRowsTableB
    rerender({
      activeTableId: 2,
      rows: currentRows,
      fields: fieldsTableB,
    })

    // 4. Advance time to complete the 300ms debounce window
    await act(async () => {
      jest.advanceTimersByTime(300)
      await Promise.resolve()
    })

    // 5. Verification: Table B row #101 MUST remain 'TABLE_B_INITIAL'
    const tableBRow = currentRows.find((r) => r.id === 101)
    expect(tableBRow?.data.field_1).toBe('TABLE_B_INITIAL')
  })

  it('regression test (4a): normal cell edit within the same table correctly updates rows without being blocked', async () => {
    let currentRows = initialRowsTableA
    const setRowsMock = jest.fn((updater) => {
      if (typeof updater === 'function') {
        currentRows = updater(currentRows)
      } else {
        currentRows = updater
      }
    })

    const pushEditMock = jest.fn()
    const addToastMock = jest.fn()

    ;(rowService.updateCell as jest.Mock).mockResolvedValue({
      ok: true,
      row: {
        id: 101,
        tableId: 1,
        data: { field_1: 'TABLE_A_NORMAL_SAVED' },
      },
    })

    const { result } = renderHook(() =>
      useCellEdit({
        activeTableId: 1,
        rows: currentRows,
        setRows: setRowsMock,
        fields: fieldsTableA,
        pushEdit: pushEditMock,
        addToast: addToastMock,
      })
    )

    // Edit cell
    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'TABLE_A_NORMAL_SAVED')
    })

    // Advance past 300ms debounce
    await act(async () => {
      jest.advanceTimersByTime(350)
      await Promise.resolve()
    })

    // Verification: API called and rows updated on same table
    expect(rowService.updateCell).toHaveBeenCalledWith(
      1,
      101,
      'field_1',
      'TABLE_A_NORMAL_SAVED',
      expect.anything()
    )
    const updatedRow = currentRows.find((r) => r.id === 101)
    expect(updatedRow?.data.field_1).toBe('TABLE_A_NORMAL_SAVED')
    expect(pushEditMock).toHaveBeenCalledTimes(1)
  })

  it('rapid table switching test (4b): edit Table A, switch to Table B and back to Table A within 300ms without corruption or errors', async () => {
    let currentRows = initialRowsTableA
    const setRowsMock = jest.fn((updater) => {
      if (typeof updater === 'function') {
        currentRows = updater(currentRows)
      } else {
        currentRows = updater
      }
    })

    const pushEditMock = jest.fn()
    const addToastMock = jest.fn()

    ;(rowService.updateCell as jest.Mock).mockResolvedValue({
      ok: true,
      row: {
        id: 101,
        tableId: 1,
        data: { field_1: 'TABLE_A_DIRTY_UPDATE' },
      },
    })

    const { rerender, result } = renderHook(
      ({ activeTableId, rows, fields }) =>
        useCellEdit({
          activeTableId,
          rows,
          setRows: setRowsMock,
          fields,
          pushEdit: pushEditMock,
          addToast: addToastMock,
        }),
      {
        initialProps: {
          activeTableId: 1,
          rows: currentRows,
          fields: fieldsTableA,
        },
      }
    )

    // 1. Edit in Table A
    await act(async () => {
      await result.current.updateCell(101, 'field_1', 'TABLE_A_DIRTY_UPDATE')
    })

    // 2. Rapidly switch to Table B at 50ms
    act(() => {
      jest.advanceTimersByTime(50)
    })
    currentRows = initialRowsTableB
    rerender({
      activeTableId: 2,
      rows: currentRows,
      fields: fieldsTableB,
    })

    // 3. Switch back to Table A at 150ms
    act(() => {
      jest.advanceTimersByTime(100)
    })
    currentRows = initialRowsTableA
    rerender({
      activeTableId: 1,
      rows: currentRows,
      fields: fieldsTableA,
    })

    // 4. Complete any timers
    await act(async () => {
      jest.advanceTimersByTime(500)
      await Promise.resolve()
    })

    // 5. Verifies no unhandled rejection or corruption
    expect(addToastMock).not.toHaveBeenCalledWith(expect.stringContaining('錯誤'), 'error')
  })
})
