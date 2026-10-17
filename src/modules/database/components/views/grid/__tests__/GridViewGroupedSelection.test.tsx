/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen } from '@testing-library/react';
import { GridView, type RowData } from '../GridView';
import type { TableField } from '@/modules/database/types';

// rows as the app passes them: RowData plus the raw tableId/data the grid also reads
type TestRow = RowData & { tableId: number; data: Record<string, string> };

// Regression: with grouping, on-screen row order differs from `rows` order, but range
// selection used min..max of original indices, so Delete/paste/autofill touched rows in
// other groups that were not selected (or not even visible).

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 36, size: 36, key: String(index) })),
    getTotalSize: () => count * 36,
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
    measure: jest.fn(),
  }),
}));

const fields: TableField[] = [
  { id: 1, tableId: 1, name: '名稱', type: 'text', order: 0, width: 150, options: null },
  { id: 2, tableId: 1, name: '類別', type: 'text', order: 1, width: 150, options: null },
];

// rows order: A(蔬菜), B(肉類), C(蔬菜). Grouped by 類別 the screen shows 肉類: B, then 蔬菜: A, C.
const rows: TestRow[] = [
  { id: 101, tableId: 1, order: 1, values: { 1: '高麗菜', 2: '蔬菜' }, data: { field_1: '高麗菜', field_2: '蔬菜' } },
  { id: 102, tableId: 1, order: 2, values: { 1: '豬肉', 2: '肉類' }, data: { field_1: '豬肉', field_2: '肉類' } },
  { id: 103, tableId: 1, order: 3, values: { 1: '菠菜', 2: '蔬菜' }, data: { field_1: '菠菜', field_2: '蔬菜' } },
];

const clickNameCell = (text: string) => {
  // cells select on mousedown (it bubbles up from the text to the cell container)
  fireEvent.mouseDown(screen.getByText(text), { button: 0 });
  fireEvent.mouseUp(window);
};

const renderGrouped = (props: Record<string, unknown> = {}) =>
  render(<GridView fields={fields} rows={rows} groupByField="field_2" {...props} />);

describe('GridView range selection in grouped view', () => {
  it('Delete clears only the rows selected on screen, not rows of other groups in between', () => {
    const onBatchUpdateCells = jest.fn();
    renderGrouped({ onBatchUpdateCells });

    // 高麗菜 (original 0) then Shift+ArrowDown to 菠菜 (original 2), which is adjacent on screen
    clickNameCell('高麗菜');
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onBatchUpdateCells).toHaveBeenCalledTimes(1);
    const touched = onBatchUpdateCells.mock.calls[0][0].map((u: { rowId: number }) => u.rowId).sort();
    expect(touched).toEqual([101, 103]);
  });

  it('pasting several lines fills the rows that follow on screen', () => {
    const onBatchUpdateCells = jest.fn();
    renderGrouped({ onBatchUpdateCells });

    // 豬肉 is first on screen, 高麗菜 second, 菠菜 third
    clickNameCell('豬肉');
    const pasteEvent = Object.assign(new Event('paste', { bubbles: true }), {
      clipboardData: { getData: () => 'x\ny' },
    });
    fireEvent(window, pasteEvent);

    expect(onBatchUpdateCells).toHaveBeenCalledTimes(1);
    const updates = onBatchUpdateCells.mock.calls[0][0];
    expect(updates).toEqual(expect.arrayContaining([
      { rowId: 102, data: { field_1: 'x' } },
      { rowId: 101, data: { field_1: 'y' } },
    ]));
    expect(updates).toHaveLength(2);
  });

  it('Tab past the last cell of a row that is last in `rows` but not on screen moves on instead of adding a row', () => {
    // rows order: 雞肉(肉類), 白菜(蔬菜), 牛肉(肉類). On screen: 肉類: 雞肉, 牛肉, then 蔬菜: 白菜.
    // 牛肉 is the last entry of `rows` but not the last row on screen.
    const reordered: TestRow[] = [
      { id: 201, tableId: 1, order: 1, values: { 1: '雞肉', 2: '肉類' }, data: { field_1: '雞肉', field_2: '肉類' } },
      { id: 202, tableId: 1, order: 2, values: { 1: '白菜', 2: '蔬菜' }, data: { field_1: '白菜', field_2: '蔬菜' } },
      { id: 203, tableId: 1, order: 3, values: { 1: '牛肉', 2: '肉類' }, data: { field_1: '牛肉', field_2: '肉類' } },
    ];
    const onAddRow = jest.fn();
    const onBatchUpdateCells = jest.fn();
    render(<GridView fields={fields} rows={reordered} groupByField="field_2" onAddRow={onAddRow} onBatchUpdateCells={onBatchUpdateCells} />);

    clickNameCell('牛肉');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(onAddRow).not.toHaveBeenCalled();

    // the selection is now on 白菜 (next on screen): Delete clears that row only
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onBatchUpdateCells).toHaveBeenCalledWith([{ rowId: 202, data: { field_1: null } }]);
  });
});
