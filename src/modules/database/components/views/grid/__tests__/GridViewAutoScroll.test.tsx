/**
 * @jest-environment jsdom
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { GridView } from '../GridView'
import type { TableField } from '@/modules/database/types'

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

describe('GridView Explicit Trigger Auto-Scroll (Issue 5)', () => {
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
      values: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 10: 'B1', 11: 'B2', 12: 'B3', 13: 'B4', 14: 'B5' },
      data: { field_1: 'A', field_2: 'B', field_3: 'C' },
      createdAt: '',
      updatedAt: '',
    },
  ] as any

  let scrollToMock: jest.Mock
  const MOCK_SCROLL_WIDTH = 1200

  beforeEach(() => {
    scrollToMock = jest.fn()
    Element.prototype.scrollTo = scrollToMock
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return MOCK_SCROLL_WIDTH
      },
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // (Diagnostic Test) Verify that newFieldScrollTrigger ALONE drives scroll without fields.length heuristic
  test('diagnostic test: newFieldScrollTrigger increment (0 -> 1) triggers scroll to right (1200px) even when fields array does not change length', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    expect(scrollToMock).not.toHaveBeenCalled()

    // Trigger increments (0 -> 1), fields length is unchanged
    rerender(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={1}
      />
    )

    // On old code (which only checks fields.length > prevFieldsCount), this will FAIL (0 calls vs 1 call)
    expect(scrollToMock).toHaveBeenCalledTimes(1)
    expect(scrollToMock).toHaveBeenCalledWith({
      left: MOCK_SCROLL_WIDTH,
      behavior: 'smooth',
    })
  })

  // (a) Initial load does NOT scroll
  test('case a: initial load with fields arriving from API does NOT trigger smooth scrollTo right', () => {
    render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    expect(scrollToMock).not.toHaveBeenCalled()
  })

  // (b) Table switch + async fields arrival (e.g. 3 -> 5) does NOT scroll
  test('case b: table switch followed by async fields arrival does NOT trigger smooth scrollTo right', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    // Step 1: User switches to Table B (fields still Table A's 3 fields)
    rerender(
      <GridView
        tableId={20}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    // Step 2: Table B API arrives with 5 fields (fields.length jumps 3 -> 5)
    rerender(
      <GridView
        tableId={20}
        fields={fieldsTableB}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    // On old code, this FAILS (received 1 call with left: 1200)
    expect(scrollToMock).not.toHaveBeenCalled()
  })

  // (c) Explicit field creation (trigger 0 -> 1) triggers exactly ONE smooth scrollTo right
  test('case c: successful field creation with incremented trigger explicitly triggers ONE smooth scrollTo right', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    expect(scrollToMock).not.toHaveBeenCalled()

    const fieldsWithNewOne: TableField[] = [
      ...fieldsTableA,
      { id: 4, tableId: 10, name: '新增欄位 4', type: 'text', order: 3, width: 150, options: null },
    ]

    rerender(
      <GridView
        tableId={10}
        fields={fieldsWithNewOne}
        rows={mockRows}
        newFieldScrollTrigger={1}
      />
    )

    expect(scrollToMock).toHaveBeenCalledTimes(1)
    expect(scrollToMock).toHaveBeenCalledWith({
      left: MOCK_SCROLL_WIDTH,
      behavior: 'smooth',
    })
  })

  // (d') Failed field creation API does NOT increment trigger and does NOT scroll
  test("case d': failed field creation (trigger remains 0) does NOT trigger scroll even if fields re-render", () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    rerender(
      <GridView
        tableId={10}
        fields={[...fieldsTableA]}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    expect(scrollToMock).not.toHaveBeenCalled()
  })

  // (e) Rapid successive field creations (0 -> 1 -> 2) each trigger smooth scrollTo exactly once
  test('case e: two successive field creations each trigger smooth scroll exactly once without missing or double triggering', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    // First field creation (trigger: 0 -> 1)
    const fieldsPlusOne: TableField[] = [
      ...fieldsTableA,
      { id: 4, tableId: 10, name: '欄位 4', type: 'text', order: 3, width: 150, options: null },
    ]
    rerender(
      <GridView
        tableId={10}
        fields={fieldsPlusOne}
        rows={mockRows}
        newFieldScrollTrigger={1}
      />
    )
    expect(scrollToMock).toHaveBeenCalledTimes(1)
    expect(scrollToMock).toHaveBeenLastCalledWith({
      left: MOCK_SCROLL_WIDTH,
      behavior: 'smooth',
    })

    // Second field creation (trigger: 1 -> 2)
    const fieldsPlusTwo: TableField[] = [
      ...fieldsPlusOne,
      { id: 5, tableId: 10, name: '欄位 5', type: 'text', order: 4, width: 150, options: null },
    ]
    rerender(
      <GridView
        tableId={10}
        fields={fieldsPlusTwo}
        rows={mockRows}
        newFieldScrollTrigger={2}
      />
    )
    expect(scrollToMock).toHaveBeenCalledTimes(2)
    expect(scrollToMock).toHaveBeenLastCalledWith({
      left: MOCK_SCROLL_WIDTH,
      behavior: 'smooth',
    })
  })

  // (f) Edge case: initial 0 -> 1 trigger transition works reliably
  test('case f: edge case - first field creation from initial trigger 0 to 1 reliably triggers scroll', () => {
    const { rerender } = render(
      <GridView
        tableId={10}
        fields={fieldsTableA}
        rows={mockRows}
        newFieldScrollTrigger={0}
      />
    )

    rerender(
      <GridView
        tableId={10}
        fields={[...fieldsTableA, { id: 4, tableId: 10, name: '新欄位', type: 'text', order: 3, width: 150, options: null }]}
        rows={mockRows}
        newFieldScrollTrigger={1}
      />
    )

    expect(scrollToMock).toHaveBeenCalledTimes(1)
    expect(scrollToMock).toHaveBeenCalledWith({
      left: MOCK_SCROLL_WIDTH,
      behavior: 'smooth',
    })
  })
})
