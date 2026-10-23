/**
 * @jest-environment jsdom
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, fireEvent, screen } from '@testing-library/react';
import { GridViewCell } from '../GridViewCell';
import type { TableField } from '@/modules/database/types';

describe('GridViewCell hover residue after editing', () => {
  // edit_row_link 只在 isCellHovered 為 true 時才渲染「Expand row」，可用來觀察 hover 狀態
  // （jsdom 會丟掉 linear-gradient 背景，無法直接比對 background）
  const field: TableField = { id: 1, tableId: 1, name: '連結', type: 'edit_row_link', order: 0, options: null };

  const baseProps = {
    rowId: 1,
    field,
    value: null,
    onSelect: jest.fn(),
    onStartEdit: jest.fn(),
    onUpdate: jest.fn(),
    onCancelEdit: jest.fn(),
  };

  it('does not keep the hover state after editing ends and another cell is selected', () => {
    const { container, rerender } = render(
      <GridViewCell {...baseProps} isSelected={true} isEditing={false} />
    );
    const cell = container.querySelector('.grid-view__column') as HTMLElement;

    // 滑鼠移入格子 → hover
    fireEvent.mouseEnter(cell);
    expect(screen.getByText(/Expand row/)).toBeInTheDocument();

    // 開始編輯（編輯器可能掛在 portal，滑鼠離開格子 DOM 時不會發出 mouseleave）
    rerender(<GridViewCell {...baseProps} isSelected={true} isEditing={true} />);
    // 編輯結束
    rerender(<GridViewCell {...baseProps} isSelected={true} isEditing={false} />);
    // 選取其他格子
    rerender(<GridViewCell {...baseProps} isSelected={false} isEditing={false} />);

    expect(screen.queryByText(/Expand row/)).not.toBeInTheDocument();
  });
});
