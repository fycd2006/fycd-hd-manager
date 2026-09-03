/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/i18nContext';
import { GridView } from '../GridView';
import type { TableField } from '@/modules/database/types';

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

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

  it('selects entire row on Shift+Space and entire column on Ctrl+Space', () => {
    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    // Select row 0, col 1
    const numCell = screen.getByText('100');
    fireEvent.mouseDown(numCell, { button: 0 });

    // Press Shift + Space: should select entire row 0
    fireEvent.keyDown(window, { key: ' ', shiftKey: true });

    // MultiCell action bar should show "列已選取"
    expect(screen.getByText('列已選取')).toBeInTheDocument();

    // Press Ctrl + Space: should select entire column 1 across all 3 rows
    fireEvent.keyDown(window, { key: ' ', ctrlKey: true });

    // Selection stats pill should show "已選取 3 格" and numeric sum: 100 + 200 + 300 = 600
    expect(screen.getByText(/已選取/)).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('selects entire column when clicking column header', () => {
    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    // Click on column header for "金額"
    const colHeader = screen.getByText('金額');
    fireEvent.click(colHeader.closest('.grid-view__column--field') || colHeader);

    // Should display selection statistics pill with 3 cells and sum 600
    expect(screen.getByText(/已選取/)).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('syncs selection and opens context menu on right click of unselected cell', () => {
    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    // Right click on "項目 2" cell (row 1, col 0)
    const cellRow1 = screen.getByText('項目 2');
    const cellCol = cellRow1.closest('.grid-view__column');
    expect(cellCol).not.toHaveClass('active');

    fireEvent.contextMenu(cellCol || cellRow1, { clientX: 200, clientY: 300 });

    // Cell should now be active/selected!
    expect(cellCol).toHaveClass('active');
  });

  it('moving mouse across cells without holding left button (buttons === 0) does NOT extend selection', () => {
    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    // 1. Click on row 0, col 0
    const cell0 = screen.getByText('項目 1');
    const col0 = cell0.closest('.grid-view__column');
    fireEvent.mouseDown(col0 || cell0, { button: 0 });
    fireEvent.mouseUp(window);

    expect(col0).toHaveClass('active');

    // 2. Move mouse to row 1, col 0 without holding mouse button (buttons === 0)
    const cell1 = screen.getByText('項目 2');
    const col1 = cell1.closest('.grid-view__column');
    fireEvent.mouseEnter(col1 || cell1, { buttons: 0 });

    // Cell 1 must NOT become active or selected!
    expect(col1).not.toHaveClass('active');
    // Only Cell 0 remains selected
    expect(col0).toHaveClass('active');
  });

  it('smoothly multi-selects cells while dragging with left mouse button held (buttons === 1)', () => {
    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    // 1. Mouse down on row 0, col 0
    const cell0 = screen.getByText('項目 1');
    const col0 = cell0.closest('.grid-view__column');
    fireEvent.mouseDown(col0 || cell0, { button: 0 });

    expect(col0).toHaveClass('active');

    // 2. Drag into row 1, col 0 holding left button (buttons === 1)
    const cell1 = screen.getByText('項目 2');
    const col1 = cell1.closest('.grid-view__column');
    fireEvent.mouseEnter(col1 || cell1, { buttons: 1 });

    // Both Cell 0 and Cell 1 should now be part of the active selection!
    expect(col0).toHaveClass('active');
    expect(col1).toHaveClass('active');

    // 3. Release mouse
    fireEvent.mouseUp(window);
    expect(col0).toHaveClass('active');
    expect(col1).toHaveClass('active');
  });

  it('drags multiple selected rows together as a batch', () => {
    const handleReorder = jest.fn();
    renderWithI18n(<GridView fields={fields} rows={mockRows} onReorderRows={handleReorder} />);

    // 1. Hover row 0 and row 1 to reveal and click their row checkboxes
    const rowElements = document.querySelectorAll('.grid-view__row');
    expect(rowElements.length).toBeGreaterThanOrEqual(3);

    fireEvent.mouseEnter(rowElements[0]);
    const cb0 = rowElements[0].querySelector('input[type="checkbox"]');
    expect(cb0).toBeTruthy();
    fireEvent.click(cb0!);

    fireEvent.mouseEnter(rowElements[1]);
    const cb1 = rowElements[1].querySelector('input[type="checkbox"]');
    expect(cb1).toBeTruthy();
    fireEvent.click(cb1!);

    // 2. Find row draggable handle on row 0
    const row0Header = rowElements[0].querySelector('.grid-view__column--no-border-right[draggable="true"]');
    expect(row0Header).toBeTruthy();

    // 3. Initiate drag on row 0
    const dataStore: Record<string, string> = {};
    const dataTransfer = {
      setData: (format: string, data: string) => { dataStore[format] = data; },
      getData: (format: string) => dataStore[format] || '',
      setDragImage: jest.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    fireEvent.dragStart(row0Header!, { dataTransfer });

    // Verify multi-row payload includes both row 0 and row 1: [0, 1]
    expect(dataStore['application/json']).toBe(JSON.stringify([0, 1]));

    // 4. Drop onto row 2
    const dropEvent = {
      dataTransfer: {
        getData: (format: string) => dataStore[format] || '',
      },
      preventDefault: jest.fn(),
    };
    fireEvent.drop(rowElements[2], dropEvent);

    // Verify onReorderRows was called with movingIndices [0, 1] and targetIndex 2!
    expect(handleReorder).toHaveBeenCalledWith([0, 1], 2);
  });

  it('drags single row when row is not part of a multi-selection', () => {
    const handleReorder = jest.fn();
    renderWithI18n(<GridView fields={fields} rows={mockRows} onReorderRows={handleReorder} />);

    const rowElements = document.querySelectorAll('.grid-view__row');
    const row1Header = rowElements[1].querySelector('.grid-view__column--no-border-right[draggable="true"]');
    expect(row1Header).toBeTruthy();

    const dataStore: Record<string, string> = {};
    const dataTransfer = {
      setData: (format: string, data: string) => { dataStore[format] = data; },
      getData: (format: string) => dataStore[format] || '',
      setDragImage: jest.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    // Drag row 1 without multi-selection
    fireEvent.dragStart(row1Header!, { dataTransfer });
    expect(dataStore['application/json']).toBe(JSON.stringify([1]));

    fireEvent.drop(rowElements[0], {
      dataTransfer: {
        getData: (format: string) => dataStore[format] || '',
      },
      preventDefault: jest.fn(),
    });

    expect(handleReorder).toHaveBeenCalledWith([1], 0);
  });

  it('auto-scrolls vertically when dragging near bottom/top edges', () => {
    let sTop = 100;
    const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const origScrollTopDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');

    Object.defineProperty(Element.prototype, 'scrollTop', {
      get() { return sTop; },
      set(v) { sTop = v; },
      configurable: true,
    });

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: any) {
      if (this.classList?.contains('grid-view__scroll-container')) {
        return {
          top: 100,
          bottom: 600,
          left: 50,
          right: 800,
          width: 750,
          height: 500,
          x: 50,
          y: 100,
          toJSON: () => {},
        };
      }
      return origGetBoundingClientRect.call(this);
    });

    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    const scrollContainer = document.querySelector('.grid-view__scroll-container') as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    // Set scroll position to 100 after initial mount resets
    sTop = 100;

    // 1. Drag near bottom edge (clientY = 580, bottom is 600)
    scrollContainer.dispatchEvent(new MouseEvent('dragover', { clientX: 400, clientY: 580, bubbles: true }));
    expect(sTop).toBeGreaterThan(100);

    // 2. Drag near top edge (clientY = 140, top is 100, topThreshold is 196)
    const prevScrollTop = sTop;
    scrollContainer.dispatchEvent(new MouseEvent('dragover', { clientX: 400, clientY: 140, bubbles: true }));
    expect(sTop).toBeLessThan(prevScrollTop);

    // 3. Stop scrolling on dragEnd
    window.dispatchEvent(new Event('dragend'));

    // Cleanup
    if (origScrollTopDescriptor) {
      Object.defineProperty(Element.prototype, 'scrollTop', origScrollTopDescriptor);
    }
    jest.restoreAllMocks();
  });

  it('auto-scrolls horizontally when dragging column near right/left edges', () => {
    let sLeft = 100;
    const origGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    const origScrollLeftDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');

    Object.defineProperty(Element.prototype, 'scrollLeft', {
      get() { return sLeft; },
      set(v) { sLeft = v; },
      configurable: true,
    });

    jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: any) {
      if (this.classList?.contains('grid-view__scroll-container')) {
        return {
          top: 100,
          bottom: 600,
          left: 50,
          right: 800,
          width: 750,
          height: 500,
          x: 50,
          y: 100,
          toJSON: () => {},
        };
      }
      return origGetBoundingClientRect.call(this);
    });

    renderWithI18n(<GridView fields={fields} rows={mockRows} />);

    const scrollContainer = document.querySelector('.grid-view__scroll-container') as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    // Set scroll position to 100 after initial mount resets
    sLeft = 100;

    // 1. Drag near right edge (clientX = 780, right is 800)
    scrollContainer.dispatchEvent(new MouseEvent('dragover', { clientX: 780, clientY: 300, bubbles: true }));
    expect(sLeft).toBeGreaterThan(100);

    // 2. Drag near left edge (clientX = 80, left is 50, leftThreshold is 176)
    const prevScrollLeft = sLeft;
    scrollContainer.dispatchEvent(new MouseEvent('dragover', { clientX: 80, clientY: 300, bubbles: true }));
    expect(sLeft).toBeLessThan(prevScrollLeft);

    // 3. Drop stops scrolling
    scrollContainer.dispatchEvent(new Event('drop', { bubbles: true }));

    // Cleanup
    if (origScrollLeftDescriptor) {
      Object.defineProperty(Element.prototype, 'scrollLeft', origScrollLeftDescriptor);
    }
    jest.restoreAllMocks();
  });
});

function onBatchUpdateCalls(mockFn: jest.Mock) {
  return mockFn.mock.calls[0][0];
}
