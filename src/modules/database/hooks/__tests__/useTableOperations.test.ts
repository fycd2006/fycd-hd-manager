/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useTableOperations } from '../useTableOperations'
import { TableRow } from '@/modules/database/types'

describe('useTableOperations - Cross-Table Operation Isolation Bug Reproduction', () => {
  it('reproduces bug: Table A pending operation leaks into Table B when switching tables with matching row ID', () => {
    // 1. Hook starts on Table A (tableId = 1)
    let activeTableId = 1
    const { result, rerender } = renderHook(
      ({ tableId }) => useTableOperations(tableId),
      { initialProps: { tableId: activeTableId } }
    )

    // 2. User makes an edit in Table A on Row #101 -> pending operation added for Table A
    act(() => {
      result.current.dispatch({
        type: 'ADD_OPERATION',
        payload: {
          id: 'op_table_a_1',
          type: 'update',
          status: 'pending',
          createdAt: Date.now(),
          tableId: 1, // Origin is Table A (tableId: 1)
          rowIds: [101],
          fieldKey: 'field_title',
          value: 'TABLE_A_DIRTY_TITLE',
        },
      })
    })

    // 3. User switches to Table B (tableId = 2)
    activeTableId = 2
    rerender({ tableId: activeTableId })

    // 4. Server returns rows for Table B, which happens to have a row with ID #101
    const serverRowsTableB: TableRow[] = [
      {
        id: 101,
        tableId: 2, // Table B
        order: 1000,
        data: { field_title: 'CLEAN_TABLE_B_TITLE' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    // 5. mergeServerRows is called for Table B
    act(() => {
      result.current.mergeServerRows(serverRowsTableB)
    })

    // 6. Verification: Table B row #101 SHOULD remain 'CLEAN_TABLE_B_TITLE'
    // BUG IN CURRENT CODE: It gets overwritten with 'TABLE_A_DIRTY_TITLE' from Table A!
    const rowInTableB = result.current.rows.find((r) => r.id === 101)

    // This assertion will FAIL before fix, proving the data corruption bug exists!
    expect(rowInTableB?.data.field_title).toBe('CLEAN_TABLE_B_TITLE')
  })
})
