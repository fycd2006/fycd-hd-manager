/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useRowOperations } from '../useRowOperations';
import * as rowService from '@/modules/database/services/row';
import { TableRow, TableField } from '@/modules/database/types';

jest.mock('@/modules/database/services/row', () => ({
  reorderRows: jest.fn().mockResolvedValue({ ok: true }),
  updateRow: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('useRowOperations - Batch Multi-Row Reorder', () => {
  const mockFields: TableField[] = [
    { id: 1, name: 'Name', type: 'text', tableId: 1, order: 0, options: null },
    { id: 2, name: 'Status', type: 'single_select', tableId: 1, order: 1, options: null },
  ];

  const initialRows: TableRow[] = [
    { id: 101, tableId: 1, order: 0, data: { field_1: 'A', field_2: 'Todo' }, createdAt: '', updatedAt: '' },
    { id: 102, tableId: 1, order: 1, data: { field_1: 'B', field_2: 'Todo' }, createdAt: '', updatedAt: '' },
    { id: 103, tableId: 1, order: 2, data: { field_1: 'C', field_2: 'Doing' }, createdAt: '', updatedAt: '' },
    { id: 104, tableId: 1, order: 3, data: { field_1: 'D', field_2: 'Done' }, createdAt: '', updatedAt: '' },
  ];

  let rowsState: TableRow[];
  const setRows = jest.fn((newRows) => {
    rowsState = typeof newRows === 'function' ? newRows(rowsState) : newRows;
  });
  const addToast = jest.fn();
  const setSortField = jest.fn();
  const setSortRules = jest.fn();
  const setSortOrder = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    rowsState = [...initialRows];
  });

  it('moves multiple rows [0, 1] (A, B) forward to target row 3 (D)', async () => {
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        activeViewId: 10,
        fields: mockFields,
        rows: rowsState,
        setRows,
        displayRows: rowsState,
        addToast,
        setSortField,
        setSortRules,
        setSortOrder,
      })
    );

    // Reorder indices [0, 1] to target index 3 (Row D)
    await act(async () => {
      await result.current.handleReorderRows([0, 1], 3);
    });

    // Expected order: [C, A, B, D] -> Row IDs: [103, 101, 102, 104]
    expect(setRows).toHaveBeenCalled();
    const updated = setRows.mock.calls[0][0];
    expect(updated.map((r: TableRow) => r.id)).toEqual([103, 101, 102, 104]);

    // Backend call verification
    expect(rowService.reorderRows).toHaveBeenCalledWith(1, [103, 101, 102, 104]);
    expect(addToast).toHaveBeenCalledWith('已移動 2 列資料', 'success');
  });

  it('moves multiple rows [2, 3] (C, D) backward to target row 0 (A)', async () => {
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        activeViewId: 10,
        fields: mockFields,
        rows: rowsState,
        setRows,
        displayRows: rowsState,
        addToast,
        setSortField,
        setSortRules,
        setSortOrder,
      })
    );

    // Reorder indices [2, 3] to target index 0 (Row A)
    await act(async () => {
      await result.current.handleReorderRows([2, 3], 0);
    });

    // Expected order: [C, D, A, B] -> Row IDs: [103, 104, 101, 102]
    expect(setRows).toHaveBeenCalled();
    const updated = setRows.mock.calls[0][0];
    expect(updated.map((r: TableRow) => r.id)).toEqual([103, 104, 101, 102]);

    expect(rowService.reorderRows).toHaveBeenCalledWith(1, [103, 104, 101, 102]);
    expect(addToast).toHaveBeenCalledWith('已移動 2 列資料', 'success');
  });

  it('updates group values when dragging rows across groups', async () => {
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        activeViewId: 10,
        fields: mockFields,
        rows: rowsState,
        setRows,
        displayRows: rowsState,
        groupByField: 'field_2',
        addToast,
        setSortField,
        setSortRules,
        setSortOrder,
      })
    );

    // Move rows 0 and 1 (status: 'Todo') to row 2 (status: 'Doing')
    await act(async () => {
      await result.current.handleReorderRows([0, 1], 2);
    });

    // updateRow should be called for both row 101 and row 102 with { field_2: 'Doing' }
    expect(rowService.updateRow).toHaveBeenCalledWith(1, 101, { field_2: 'Doing' });
    expect(rowService.updateRow).toHaveBeenCalledWith(1, 102, { field_2: 'Doing' });
  });

  it('supports single number input for backwards compatibility', async () => {
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        activeViewId: 10,
        fields: mockFields,
        rows: rowsState,
        setRows,
        displayRows: rowsState,
        addToast,
        setSortField,
        setSortRules,
        setSortOrder,
      })
    );

    // Move row 0 to index 2
    await act(async () => {
      await result.current.handleReorderRows(0, 2);
    });

    expect(setRows).toHaveBeenCalled();
    const updated = setRows.mock.calls[0][0];
    expect(updated.map((r: TableRow) => r.id)).toEqual([102, 101, 103, 104]);
    expect(addToast).toHaveBeenCalledWith('已儲存資料列順序', 'success');
  });
});
