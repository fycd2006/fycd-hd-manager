/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { GridView } from '../GridView';
import type { TableField } from '@/modules/database/types';

// Mock react-virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 36, key: '0' },
      { index: 1, start: 36, size: 36, key: '1' },
      { index: 2, start: 72, size: 36, key: '2' },
    ],
    getTotalSize: () => 108,
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
    measure: jest.fn(),
  }),
}));

describe('GridView Desktop UX Operations', () => {
  const fields: TableField[] = [
    { id: 1, tableId: 1, name: '名稱', type: 'text', order: 0, width: 150, options: null },
    { id: 2, tableId: 1, name: '金額', type: 'number', order: 1, width: 120, options: null },
    { id: 3, tableId: 1, name: '啟用', type: 'boolean', order: 2, width: 100, options: null },
  ];

  const mockRows = [
    { id: 101, tableId: 1, order: 1, values: { 1: '項目 1', 2: 100, 3: true }, data: { field_1: '項目 1', field_2: 100, field_3: true } },
    { id: 102, tableId: 1, order: 2, values: { 1: '項目 2', 2: 200, 3: false }, data: { field_1: '項目 2', field_2: 200, field_3: false } },
    { id: 103, tableId: 1, order: 3, values: { 1: '項目 3', 2: 300, 3: true }, data: { field_1: '項目 3', field_2: 300, field_3: true } },
  ] as any;

  it('keeps cell in selected state after Enter instead of forcing edit mode', () => {
    render(<GridView fields={fields} rows={mockRows} />);

    // MouseDown on first row, first column cell
    const cell = screen.getByText('項目 1');
    fireEvent.mouseDown(cell, { button: 0 });

    // Press Enter to move down
    fireEvent.keyDown(window, { key: 'Enter' });

    // Cell at row 1, col 0 should be selected, but NOT have an active <input> element forced
    const inputs = screen.queryAllByRole('textbox');
    expect(inputs.length).toBe(0);
  });

  it('supports double click on autofill handle to fill down', () => {
    const onBatchUpdateCells = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onBatchUpdateCells={onBatchUpdateCells} />);

    // MouseDown on first cell to select it
    const cell = screen.getByText('項目 1');
    fireEvent.mouseDown(cell, { button: 0 });

    // Autofill handle should be in the DOM with title "拖曳填滿；雙擊自動向下填滿"
    const handle = screen.getByTitle('拖曳填滿；雙擊自動向下填滿');
    expect(handle).toBeInTheDocument();

    // Double click the autofill handle
    fireEvent.doubleClick(handle);

    // Should trigger batch update down to the last row
    expect(onBatchUpdateCells).toHaveBeenCalledTimes(1);
    const updates = onBatchUpdateCells.mock.calls[0][0];
    expect(updates.length).toBe(2); // rows 102 and 103
    expect(updates[0].data.field_1).toBe('項目 1');
    expect(updates[1].data.field_1).toBe('項目 1');
  });

  it('drags autofill handle and fills targeted range on mouseup', () => {
    const onBatchUpdateCells = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onBatchUpdateCells={onBatchUpdateCells} />);

    // MouseDown on first cell
    const cell = screen.getByText('項目 1');
    fireEvent.mouseDown(cell, { button: 0 });

    const handle = screen.getByTitle('拖曳填滿；雙擊自動向下填滿');

    // Start autofill drag on handle
    fireEvent.mouseDown(handle, { button: 0 });

    // Move mouse over cell in row 1, col 0
    const cellRow1 = screen.getByText('項目 2');
    fireEvent.mouseEnter(cellRow1.closest('.grid-cell') || cellRow1);

    // Release mouse
    fireEvent.mouseUp(window);

    expect(onBatchUpdateCells).toHaveBeenCalledTimes(1);
    const updates = onBatchUpdateCalls(onBatchUpdateCells);
    expect(updates.length).toBeGreaterThan(0);
  });

  it('sanitizes number and boolean types when pasting into cells', async () => {
    const onBatchUpdateCells = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onBatchUpdateCells={onBatchUpdateCells} />);

    // Select row 0, col 1 (number field)
    const numCell = screen.getByText('100');
    fireEvent.mouseDown(numCell, { button: 0 });

    // Paste formatted currency string into number cell
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: (format: string) => (format === 'text/plain' || !format ? '$1,250.50' : ''),
      },
    });
    window.dispatchEvent(pasteEvent);

    await waitFor(() => {
      expect(onBatchUpdateCells).toHaveBeenCalled();
    });

    const updates = onBatchUpdateCells.mock.calls[0][0];
    // field_2 should be parsed as clean number 1250.5, NOT raw string "$1,250.50"
    expect(updates[0].data.field_2).toBe(1250.5);
  });
});

function onBatchUpdateCalls(mockFn: jest.Mock) {
  return mockFn.mock.calls[0][0];
}
