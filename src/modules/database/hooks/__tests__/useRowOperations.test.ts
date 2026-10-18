/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useRowOperations, stripReadOnlyCells } from '../useRowOperations';
import * as rowService from '@/modules/database/services/row';
import { TableRow, TableField } from '@/modules/database/types';

jest.mock('@/modules/database/services/row', () => ({
  reorderRows: jest.fn().mockResolvedValue({ ok: true }),
  updateRow: jest.fn().mockResolvedValue({ ok: true }),
  batchCreateRows: jest.fn(),
  createRow: jest.fn(),
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

describe('stripReadOnlyCells', () => {
  it('removes every read-only field type and keeps writable cells', () => {
    const types = ['formula', 'lookup', 'rollup', 'count', 'autonumber', 'uuid', 'created_on', 'created_by', 'last_modified_on', 'last_modified_by', 'edit_row_link'];
    const fields = [{ id: 1, type: 'text' }, ...types.map((t, i) => ({ id: i + 2, type: t }))];
    const data: Record<string, unknown> = { field_1: 'keep' };
    types.forEach((_, i) => { data[`field_${i + 2}`] = 'x'; });
    expect(stripReadOnlyCells(data, fields)).toEqual({ field_1: 'keep' });
    expect(data.field_2).toBe('x');
  });
});

describe('useRowOperations - batchAddRows rejected cells', () => {
  const fields: TableField[] = [
    { id: 1, name: '數量', type: 'number', tableId: 1, order: 0, options: null },
  ];

  it('toasts the rejected summary when the batch POST reports rejected cells', async () => {
    const addToast = jest.fn();
    const setRows = jest.fn();
    (rowService.batchCreateRows as jest.Mock).mockResolvedValue({
      ok: true,
      rows: [{ id: 1, tableId: 1, order: 1, data: { field_1: null }, createdAt: '', updatedAt: '' }],
      rejected: [{ clientId: 'c1', fieldId: 1, code: 'invalid_number', reason: '必須是有效的數字' }],
    });
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        fields,
        rows: [],
        setRows,
        displayRows: [],
        addToast,
        setSortField: jest.fn(),
        setSortRules: jest.fn(),
        setSortOrder: jest.fn(),
      })
    );
    await act(async () => {
      await result.current.batchAddRows([{ field_1: 'abc' }, { field_1: '5' }]);
    });
    expect(addToast).toHaveBeenCalledWith('已寫入 1 格，1 格未寫入：數量 必須是有效的數字', 'info');
  });
});

describe('useRowOperations - addRow copying the last row', () => {
  it('does not copy read-only or latest_comment cells from the previous row', async () => {
    const fields: TableField[] = [
      { id: 1, name: '名稱', type: 'text', tableId: 1, order: 0, options: null },
      { id: 2, name: '備註', type: 'latest_comment', tableId: 1, order: 1, options: null },
      { id: 3, name: '編號', type: 'autonumber', tableId: 1, order: 2, options: null },
    ];
    const rows: TableRow[] = [{
      id: 1, tableId: 1, order: 0, createdAt: '', updatedAt: '',
      data: { field_1: '高麗菜', field_2: [{ id: 'c1', user: 'bob', time: 't', content: '舊留言' }], field_3: 7 },
    }];
    (rowService.createRow as jest.Mock).mockResolvedValue({ ok: false });
    const { result } = renderHook(() =>
      useRowOperations({
        activeTableId: 1,
        fields,
        rows,
        setRows: jest.fn(),
        displayRows: rows,
        addToast: jest.fn(),
        setSortField: jest.fn(),
        setSortRules: jest.fn(),
        setSortOrder: jest.fn(),
      })
    );
    await act(async () => {
      await result.current.addRow(undefined, true);
    });
    expect(rowService.createRow).toHaveBeenCalledWith(1, { field_1: '高麗菜' });
  });
});
