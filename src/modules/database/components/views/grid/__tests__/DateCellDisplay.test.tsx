/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GridViewCell } from '../GridViewCell';
import type { TableField } from '@/modules/database/types';

function renderCell(type: 'date' | 'created_on', options: Record<string, unknown>, value: string) {
  const field: TableField = { id: 9, tableId: 1, name: '日期', type, order: 0, options: JSON.stringify(options) };
  render(
    <GridViewCell
      rowId={1}
      field={field}
      value={value}
      isSelected={false}
      isEditing={false}
      onSelect={jest.fn()}
      onStartEdit={jest.fn()}
      onUpdate={jest.fn()}
      onUpdateField={jest.fn()}
      onCancelEdit={jest.fn()}
    />
  );
}

describe('date cell display follows the field date options', () => {
  it('date: shows date and 12-hour time in the field time zone', () => {
    renderCell('date', { date_include_time: true, date_time_format: '12', date_time_zone: 'Asia/Taipei' }, '2026-10-18T06:30:00.000Z');
    expect(screen.getByText('2026-10-18 2:30 PM')).toBeInTheDocument();
  });

  it('created_on: shows date and 24-hour time in the field time zone', () => {
    renderCell('created_on', { date_time_zone: 'Asia/Taipei' }, '2026-10-18T06:30:00.000Z');
    expect(screen.getByText(/2026-10-18 14:30/)).toBeInTheDocument();
  });
});
