/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { GridViewCell } from '../GridViewCell';
import type { TableField } from '@/modules/database/types';

const choices = [{ id: 'a1', name: 'A', color: '#eee' }];

const makeField = (type: 'single_select' | 'multiple_select'): TableField => ({
  id: 7, tableId: 1, name: '類別', type, order: 0, options: JSON.stringify({ choices }),
});

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

function renderCell(type: 'single_select' | 'multiple_select', onUpdate: jest.Mock, onUpdateField: jest.Mock) {
  render(
    <GridViewCell
      rowId={1}
      field={makeField(type)}
      value={type === 'multiple_select' ? [] : null}
      isSelected
      isEditing
      onSelect={jest.fn()}
      onStartEdit={jest.fn()}
      onUpdate={onUpdate}
      onUpdateField={onUpdateField}
      onCancelEdit={jest.fn()}
    />
  );
  return screen.getByPlaceholderText(/搜尋或輸入新增/);
}

describe('inline option creation in the cell editor', () => {
  it('single select: sends the cell write only after the field update resolves', async () => {
    const field = deferred();
    const onUpdate = jest.fn();
    const onUpdateField = jest.fn().mockReturnValue(field.promise);
    const input = renderCell('single_select', onUpdate, onUpdateField);

    fireEvent.change(input, { target: { value: '新選項' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onUpdateField).toHaveBeenCalledWith(7, { options: { choices: expect.arrayContaining([expect.objectContaining({ name: '新選項' })]) } });
    expect(onUpdate).not.toHaveBeenCalled();

    await act(async () => { field.resolve(); await field.promise; });
    await act(async () => { await Promise.resolve(); });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('新選項');
  });

  it('single select: still sends the cell write when the field update fails', async () => {
    const onUpdate = jest.fn();
    const onUpdateField = jest.fn().mockRejectedValue(new Error('x'));
    const input = renderCell('single_select', onUpdate, onUpdateField);

    fireEvent.change(input, { target: { value: '新選項' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(onUpdate).toHaveBeenCalledWith('新選項');
  });

  it('multiple select: later writes queue behind the pending field update and keep their order', async () => {
    const field = deferred();
    const onUpdate = jest.fn();
    const onUpdateField = jest.fn().mockReturnValue(field.promise);
    const input = renderCell('multiple_select', onUpdate, onUpdateField);

    fireEvent.change(input, { target: { value: '新' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByText('A'));

    expect(onUpdate).not.toHaveBeenCalled();

    await act(async () => { field.resolve(); await field.promise; });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(onUpdate.mock.calls.map((c) => c[0])).toEqual([JSON.stringify(['新']), JSON.stringify(['新', 'A'])]);
  });

  it('writes immediately when no field update is pending', () => {
    const onUpdate = jest.fn();
    const onUpdateField = jest.fn();
    renderCell('single_select', onUpdate, onUpdateField);

    fireEvent.click(screen.getByText('A'));

    expect(onUpdateField).not.toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith('A');
  });
});
