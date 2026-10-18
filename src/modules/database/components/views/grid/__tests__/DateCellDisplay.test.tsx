/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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

function renderEditingCell(options: Record<string, unknown>, value: string) {
  const onUpdate = jest.fn();
  const field: TableField = { id: 9, tableId: 1, name: '日期', type: 'date', order: 0, options: JSON.stringify(options) };
  const { container } = render(
    <GridViewCell
      rowId={1}
      field={field}
      value={value}
      isSelected
      isEditing
      onSelect={jest.fn()}
      onStartEdit={jest.fn()}
      onUpdate={onUpdate}
      onUpdateField={jest.fn()}
      onCancelEdit={jest.fn()}
    />
  );
  const input = container.querySelector('input') as HTMLInputElement;
  return { input, onUpdate };
}

describe('date cell editor follows the field date options', () => {
  const dtOptions = { date_include_time: true, date_time_zone: 'Asia/Taipei' };

  it('include time: datetime-local in field zone, commits UTC ISO only on blur', () => {
    const { input, onUpdate } = renderEditingCell(dtOptions, '2026-10-18T06:30:00.000Z');
    expect(input.type).toBe('datetime-local');
    expect(input.value).toBe('2026-10-18T14:30');
    fireEvent.change(input, { target: { value: '2026-10-18T15:00' } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('2026-10-18T07:00:00.000Z');
  });

  it('without time: keeps type=date and commits on change', () => {
    const { input, onUpdate } = renderEditingCell({}, '2026-10-18');
    expect(input.type).toBe('date');
    fireEvent.change(input, { target: { value: '2026-10-20' } });
    expect(onUpdate).toHaveBeenCalledWith('2026-10-20');
  });
});
