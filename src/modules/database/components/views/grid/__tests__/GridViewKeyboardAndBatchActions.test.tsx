/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen } from '@testing-library/react';
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

describe('GridView Keyboard Navigation, Type-over, and Batch Actions', () => {
  const fields: TableField[] = [
    { id: 1, tableId: 1, name: '名稱', type: 'text', order: 0, width: 150, options: null },
    { id: 2, tableId: 1, name: '評分', type: 'rating', order: 1, width: 120, options: null },
    { id: 3, tableId: 1, name: '完成', type: 'boolean', order: 2, width: 100, options: null },
  ];

  const mockRows = [
    { id: 101, tableId: 1, order: 1, values: { 1: '項目 A', 2: 3, 3: false }, data: { field_1: '項目 A', field_2: 3, field_3: false } },
    { id: 102, tableId: 1, order: 2, values: { 1: '項目 B', 2: 4, 3: true }, data: { field_1: '項目 B', field_2: 4, field_3: true } },
    { id: 103, tableId: 1, order: 3, values: { 1: '項目 C', 2: 5, 3: false }, data: { field_1: '項目 C', field_2: 5, field_3: false } },
  ] as any;

  it('renders rows and cells correctly', () => {
    render(<GridView fields={fields} rows={mockRows} />);
    expect(screen.getByText('名稱')).toBeInTheDocument();
    expect(screen.getByText('評分')).toBeInTheDocument();
    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.getByText('項目 A')).toBeInTheDocument();
  });

  it('handles Ctrl+A select-all shortcut and shows floating batch capsule bar', () => {
    render(<GridView fields={fields} rows={mockRows} />);
    
    // Fire Ctrl+A on window
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

    // Floating batch selection bar should appear
    expect(screen.getByText('列已選取')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /複製/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刪除/i })).toBeInTheDocument();

    // Fire Escape to clear selection
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('列已選取')).not.toBeInTheDocument();
  });

  it('handles Spacebar to toggle boolean cell directly', () => {
    const onUpdateCellMock = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onUpdateCell={onUpdateCellMock} />);

    // Click row 0, col 2 (boolean cell)
    const booleanCell = screen.getAllByRole('checkbox')[1]; // first row checkbox is header checkbox, second is row checkbox
    const cellElement = screen.getByText('項目 A').closest('.grid-view__row')?.querySelectorAll('.grid-cell')[2];
    
    if (cellElement) {
      fireEvent.click(cellElement);
      fireEvent.keyDown(window, { key: ' ' });
      expect(onUpdateCellMock).toHaveBeenCalledWith(101, 3, true);
    }
  });

  it('handles rating quick number entry (0-5)', () => {
    const onUpdateCellMock = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onUpdateCell={onUpdateCellMock} />);

    const ratingCell = screen.getByText('項目 A').closest('.grid-view__row')?.querySelectorAll('.grid-cell')[1];
    if (ratingCell) {
      fireEvent.click(ratingCell);
      fireEvent.keyDown(window, { key: '5' });
      expect(onUpdateCellMock).toHaveBeenCalledWith(101, 2, 5);
    }
  });

  it('handles auto-fit column resize on double click', () => {
    const onUpdateFieldMock = jest.fn();
    render(<GridView fields={fields} rows={mockRows} onUpdateField={onUpdateFieldMock} />);

    const resizeHandles = document.querySelectorAll('.grid-head-cell__resize-handle');
    if (resizeHandles.length > 0) {
      fireEvent.doubleClick(resizeHandles[0]);
      expect(onUpdateFieldMock).toHaveBeenCalled();
    }
  });
});
