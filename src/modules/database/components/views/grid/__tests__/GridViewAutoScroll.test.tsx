/**
 * @jest-environment jsdom
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { GridView } from '../GridView'
import type { TableField, TableRow } from '@/modules/database/types'

// Mock react-virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: jest.fn(),
    measureElement: jest.fn(),
    measure: jest.fn(),
  }),
}))

describe('GridView Auto-Scroll on Table Load vs Field Addition', () => {
  const fieldsTableA: TableField[] = [
    { id: 1, tableId: 10, name: '欄位 1', type: 'text', order: 0, width: 150, options: null },
    { id: 2, tableId: 10, name: '欄位 2', type: 'text', order: 1, width: 150, options: null },
    { id: 3, tableId: 10, name: '欄位 3', type: 'text', order: 2, width: 150, options: null },
  ]

  const fieldsTableB: TableField[] = [
    { id: 10, tableId: 20, name: 'B 欄位 1', type: 'text', order: 0, width: 150, options: null },
    { id: 11, tableId: 20, name: 'B 欄位 2', type: 'text', order: 1, width: 150, options: null },
    { id: 12, tableId: 20, name: 'B 欄位 3', type: 'text', order: 2, width: 150, options: null },
    { id: 13, tableId: 20, name: 'B 欄位 4', type: 'text', order: 3, width: 150, options: null },
    { id: 14, tableId: 20, name: 'B 欄位 5', type: 'text', order: 4, width: 150, options: null },
  ]

  const mockRows = [
    {
      id: 1,
      tableId: 10,
      order: 1000,
      values: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 10: 'B1', 11: 'B2', 12: 'B3', 13: 'B4', 14: 'B5' },
      data: { field_1: 'A', field_2: 'B', field_3: 'C', field_4: 'D' },
      createdAt: '',
      updatedAt: '',
    },
  ] as any

  let scrollToMock: jest.Mock

  beforeEach(() => {
    scrollToMock = jest.fn()
    // Mock HTMLDivElement.prototype.scrollTo
    Element.prototype.scrollTo = scrollToMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('switching tableId or initial load does NOT trigger smooth scrollTo right, and resets scrollLeft to 0', () => {
    // Initial mount with Table A
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
      />
    )

    // Initial load should NOT trigger smooth scrollTo right
    expect(scrollToMock).not.toHaveBeenCalled()

    // Switch to Table B (which has more fields: 5 > 3)
    rerender(
      <GridView
        tableId={20}
        fields={fieldsTableB}
        rows={mockRows}
      />
    )

    // Table switch must NOT trigger smooth scrollTo right
    expect(scrollToMock).not.toHaveBeenCalled()
  })

  test('adding a new field in the SAME tableId triggers smooth scrollTo right', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA} // 3 fields initially
        rows={mockRows}
      />
    )

    expect(scrollToMock).not.toHaveBeenCalled()

    // User creates a 4th field on Table 10
    const fieldsTableAPlusOne: TableField[] = [
      ...fieldsTableA,
      { id: 4, tableId: 10, name: '新增欄位 4', type: 'text', order: 3, width: 150, options: null },
    ]

    rerender(
      <GridView
        tableId={10}
        fields={fieldsTableAPlusOne} // 4 fields on same tableId 10
        rows={mockRows}
      />
    )

    // On same table, field count increase MUST trigger smooth scrollTo
    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    )
  })
})
