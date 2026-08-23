/**
 * @jest-environment jsdom
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { GridView, computeFieldSummaries, isGroupCollapsed } from '../grid/GridView'
import type { TableField, GroupCollapseState } from '@/modules/database/types'

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

describe('GridView Group By & Group Aggregations', () => {
  const mockFields: TableField[] = [
    { id: 1, tableId: 10, name: '員工姓名', type: 'text', order: 1, width: 180, options: null },
    {
      id: 2,
      tableId: 10,
      name: '部門',
      type: 'single_select',
      order: 2,
      width: 160,
      options: JSON.stringify([
        { id: 'dev', name: '研發部', color: 'blue' },
        { id: 'sales', name: '業務部', color: 'green' },
      ]),
    },
    { id: 3, tableId: 10, name: '薪資', type: 'number', order: 3, width: 140, options: null },
  ]

  const mockRows = [
    { id: 101, order: 1, values: { 1: 'Jeffrey', 2: '研發部', 3: 80000 }, data: { field_1: 'Jeffrey', field_2: '研發部', field_3: 80000 } },
    { id: 102, order: 2, values: { 1: 'Alice', 2: '研發部', 3: 90000 }, data: { field_1: 'Alice', field_2: '研發部', field_3: 90000 } },
    { id: 103, order: 3, values: { 1: 'Bob', 2: '業務部', 3: 50000 }, data: { field_1: 'Bob', field_2: '業務部', field_3: 50000 } },
  ]

  test('isGroupCollapsed computes collapse status declaratively', () => {
    // 1. Default expand mode: nothing collapsed unless in exceptions
    const defaultState: GroupCollapseState = { mode: 'expand', exceptions: {} }
    expect(isGroupCollapsed('dev', defaultState)).toBe(false)
    expect(isGroupCollapsed('sales', defaultState)).toBe(false)

    // With exception in expand mode: only exception is collapsed
    const expandWithException: GroupCollapseState = { mode: 'expand', exceptions: { dev: true } }
    expect(isGroupCollapsed('dev', expandWithException)).toBe(true)
    expect(isGroupCollapsed('sales', expandWithException)).toBe(false)

    // 2. Collapse all mode: everything collapsed unless in exceptions
    const collapseAllState: GroupCollapseState = { mode: 'collapse', exceptions: {} }
    expect(isGroupCollapsed('dev', collapseAllState)).toBe(true)
    expect(isGroupCollapsed('sales', collapseAllState)).toBe(true)
    // Dynamic new group also collapsed
    expect(isGroupCollapsed('new_marketing_dept', collapseAllState)).toBe(true)

    // With exception in collapse mode: exception is expanded (not collapsed)
    const collapseWithException: GroupCollapseState = { mode: 'collapse', exceptions: { dev: true } }
    expect(isGroupCollapsed('dev', collapseWithException)).toBe(false)
    expect(isGroupCollapsed('sales', collapseWithException)).toBe(true)
  })

  test('computeFieldSummaries computes group metrics correctly', () => {
    const devRows = mockRows.slice(0, 2)
    const summaries = computeFieldSummaries(devRows, mockFields)

    expect(summaries[1].count).toBe(2)
    expect(summaries[1].uniqueCount).toBe(2)

    // Salary (field 3) sum and avg for dev group
    expect(summaries[3].count).toBe(2)
    expect(summaries[3].sum).toBe(170000)
    expect(summaries[3].avg).toBe(85000)
    expect(summaries[3].min).toBe(80000)
    expect(summaries[3].max).toBe(90000)
  })

  test('renders group header banners with rich badges and column-aligned group aggregations', () => {
    render(
      <GridView
        fields={mockFields}
        rows={mockRows}
        groupByField="field_2"
        initialAggregations={{ 3: 'sum' }}
      />
    )

    // Verify group names are displayed with badges
    expect(screen.getAllByText('研發部').length).toBeGreaterThan(0)
    expect(screen.getAllByText('業務部').length).toBeGreaterThan(0)

    // Verify group row count badges
    expect(screen.getByText('2 筆')).toBeInTheDocument()
    expect(screen.getByText('1 筆')).toBeInTheDocument()

    // Verify group-level aggregations
    // 研發部 salary sum: Σ 170000
    expect(screen.getByText('Σ 170000')).toBeInTheDocument()
    // 業務部 salary sum: Σ 50000
    expect(screen.getByText('Σ 50000')).toBeInTheDocument()
  })

  test('collapses and expands group on header click', () => {
    render(
      <GridView
        fields={mockFields}
        rows={mockRows}
        groupByField="field_2"
      />
    )

    // Click on 研發部 group header to collapse
    const clickableHeaderCells = screen.getAllByTitle('點擊折疊分組')
    expect(clickableHeaderCells.length).toBeGreaterThan(0)
    fireEvent.click(clickableHeaderCells[0])

    // Title changes to expand hint
    expect(screen.getByTitle('點擊展開分組')).toBeInTheDocument()
  })

  test('renders multi-level hierarchical grouping with nested banners and sub-groups', () => {
    const multiLevelFields: TableField[] = [
      { id: 1, tableId: 10, name: '姓名', type: 'text', order: 1, width: 180, options: null },
      { id: 2, tableId: 10, name: '成全階段', type: 'single_select', order: 2, width: 160, options: null },
      { id: 3, tableId: 10, name: '班級', type: 'single_select', order: 3, width: 160, options: null },
    ]

    const multiLevelRows = [
      { id: 201, order: 1, values: { 1: '張小明', 2: '培訓階段', 3: '週六上午班' }, data: { field_1: '張小明', field_2: '培訓階段', field_3: '週六上午班' } },
      { id: 202, order: 2, values: { 1: '李小華', 2: '培訓階段', 3: '週日上午班' }, data: { field_1: '李小華', field_2: '培訓階段', field_3: '週日上午班' } },
      { id: 203, order: 3, values: { 1: '王大同', 2: '實習階段', 3: '週六下午班' }, data: { field_1: '王大同', field_2: '實習階段', field_3: '週六下午班' } },
    ]

    render(
      <GridView
        fields={multiLevelFields}
        rows={multiLevelRows}
        groupByRules={[
          { fieldKey: 'field_2', order: 'asc' },
          { fieldKey: 'field_3', order: 'asc' },
        ]}
      />
    )

    // Check top level group banners
    expect(screen.getAllByText('成全階段:').length).toBe(2)
    expect(screen.getAllByText('培訓階段').length).toBeGreaterThan(0)
    expect(screen.getAllByText('實習階段').length).toBeGreaterThan(0)

    // Check nested sub-level group banner (Then by)
    expect(screen.getAllByText('Then by 班級:').length).toBe(3)
    expect(screen.getAllByText('週六上午班').length).toBeGreaterThan(0)
    expect(screen.getAllByText('週日上午班').length).toBeGreaterThan(0)
    expect(screen.getAllByText('週六下午班').length).toBeGreaterThan(0)
  })
})



