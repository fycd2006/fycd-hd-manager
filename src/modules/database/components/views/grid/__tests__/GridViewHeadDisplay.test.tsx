/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GridViewHead } from '../GridViewHead'
import { GridViewRow } from '../GridViewRow'
import type { TableField } from '@/modules/database/types'

describe('GridViewHead & GridViewRow Display Defaults', () => {
  const mockFields: TableField[] = [
    {
      id: 1,
      tableId: 10,
      name: '欄位名稱',
      type: 'text',
      order: 0,
      options: null,
      width: 200,
    },
  ]

  const mockRow = {
    id: 101,
    order: 0,
    values: { 1: '測試資料' },
  }

  it('renders GridViewHead with header height and header font size variables', () => {
    const { container } = render(
      <GridViewHead
        fields={mockFields}
        rowDetailsWidth={60}
      />
    )

    const headDiv = container.querySelector('.grid-view__head') as HTMLElement
    expect(headDiv).toBeInTheDocument()
    expect(headDiv.style.height).toBe('var(--grid-header-height, 36px)')

    const colName = container.querySelector('span[style*="font-size: var(--grid-font-size-head"]') || container.querySelector('span[style*="var(--grid-font-size-head"]')
    expect(colName).toBeInTheDocument()
    expect((colName as HTMLElement).style.fontSize).toBe('var(--grid-font-size-head, 12px)')
  })

  it('renders GridViewRow with row height and row number font size variables', () => {
    const { container } = render(
      <GridViewRow
        row={mockRow}
        rowIndex={0}
        fields={mockFields}
        onSelectCell={jest.fn()}
        onStartEditCell={jest.fn()}
        onUpdateCell={jest.fn()}
        onCancelEditCell={jest.fn()}
        rowDetailsWidth={60}
      />
    )

    const rowDiv = container.firstElementChild as HTMLElement
    expect(rowDiv).toBeInTheDocument()
    expect(rowDiv.style.height).toBe('var(--row-height, 32px)')

    const rowNumSpan = container.querySelector('span[style*="font-size: var(--grid-font-size-sm"]') || container.querySelector('span[style*="var(--grid-font-size-sm"]')
    expect(rowNumSpan).toBeInTheDocument()
    expect((rowNumSpan as HTMLElement).style.fontSize).toBe('var(--grid-font-size-sm, 11px)')
  })
})
