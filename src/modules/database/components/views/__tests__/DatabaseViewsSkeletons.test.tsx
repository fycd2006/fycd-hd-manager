/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import KanbanView from '../kanban/KanbanView'
import GalleryView from '../gallery/GalleryView'
import CalendarView from '../calendar/CalendarView'
import TimelineView from '../timeline/TimelineView'
import FormView from '../form/FormView'
import { DatabaseViewRouter } from '../DatabaseViewRouter'
import type { TableField, TableRow } from '../../../types'

// Mock i18n
jest.mock('@/lib/i18n/i18nContext', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (params?.id) return `Row #${params.id}`
      return key
    },
    locale: 'zh-TW',
  }),
}))

// Mock UI Store
jest.mock('@/modules/database/store', () => ({
  useUIStore: () => [{}, { addToast: jest.fn() }],
}))

describe('Database Views Skeleton & UI/UX Consistency', () => {
  const mockFields: TableField[] = [
    { id: 1, tableId: 10, name: 'Title', type: 'text', order: 0, options: null },
    { id: 2, tableId: 10, name: 'Status', type: 'single_select', order: 1, options: JSON.stringify(['Todo', 'Doing', 'Done']) },
    { id: 3, tableId: 10, name: 'Due Date', type: 'date', order: 2, options: null },
  ]

  const todayStr = new Date().toISOString().slice(0, 10)
  const mockRows: TableRow[] = [
    {
      id: 101,
      tableId: 10,
      order: 0,
      createdAt: `${todayStr}T00:00:00.000Z`,
      data: {
        field_1: 'Task 1',
        field_2: 'Todo',
        field_3: todayStr,
      },
    },
  ]

  describe('KanbanView', () => {
    it('renders KanbanViewSkeleton when loading is true', () => {
      const { container } = render(
        <KanbanView
          fields={mockFields}
          rows={mockRows}
          loading={true}
          onUpdateCell={jest.fn()}
          onExpandRow={jest.fn()}
        />
      )
      // Check for shimmer bar
      expect(container.querySelector('div')).toBeInTheDocument()
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    })

    it('renders kanban board cards when loading is false', () => {
      render(
        <KanbanView
          fields={mockFields}
          rows={mockRows}
          loading={false}
          onUpdateCell={jest.fn()}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })
  })

  describe('GalleryView', () => {
    it('renders GalleryViewSkeleton when loading is true', () => {
      render(
        <GalleryView
          fields={mockFields}
          rows={mockRows}
          loading={true}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    })

    it('renders gallery cards when loading is false', () => {
      render(
        <GalleryView
          fields={mockFields}
          rows={mockRows}
          loading={false}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })
  })

  describe('CalendarView', () => {
    it('renders CalendarViewSkeleton when loading is true', () => {
      render(
        <CalendarView
          fields={mockFields}
          rows={mockRows}
          loading={true}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    })

    it('renders calendar days and event cards when loading is false', () => {
      render(
        <CalendarView
          fields={mockFields}
          rows={mockRows}
          loading={false}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })
  })

  describe('TimelineView', () => {
    it('renders TimelineViewSkeleton when loading is true', () => {
      render(
        <TimelineView
          fields={mockFields}
          rows={mockRows}
          loading={true}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()
    })

    it('renders timeline tasks when loading is false', () => {
      render(
        <TimelineView
          fields={mockFields}
          rows={mockRows}
          loading={false}
          onExpandRow={jest.fn()}
        />
      )
      expect(screen.getAllByText('Task 1')[0]).toBeInTheDocument()
    })
  })

  describe('FormView', () => {
    it('renders FormViewSkeleton when loading is true', () => {
      render(
        <FormView
          tableId={10}
          tableName="Test Table"
          fields={mockFields}
          loading={true}
        />
      )
      expect(screen.queryByText('Test Table')).not.toBeInTheDocument()
    })

    it('renders form inputs when loading is false', () => {
      render(
        <FormView
          tableId={10}
          tableName="Test Table"
          fields={mockFields}
          loading={false}
        />
      )
      expect(screen.getByText('Test Table')).toBeInTheDocument()
    })
  })

  describe('DatabaseViewRouter', () => {
    it('passes gridLoading correctly to currentView', () => {
      const { rerender } = render(
        <DatabaseViewRouter
          currentView="kanban"
          fields={mockFields}
          hiddenFieldKeys={[]}
          displayRows={mockRows}
          gridLoading={true}
          readOnly={false}
          frozenColumnsCount={0}
          columnWidths={{}}
          sortField={null}
          sortOrder="asc"
          groupByField={null}
          editingFieldId={null}
          editingFieldName=""
          editingCell={null}
          editInputRef={{ current: null }}
          searchQuery=""
          filterRules={[]}
          groupedRows={{}}
          getRowBgColorClass={() => ''}
          updateCell={jest.fn()}
          toggleSort={jest.fn()}
          setEditingFieldId={jest.fn()}
          setEditingFieldName={jest.fn()}
          handleColumnDragStart={jest.fn()}
          handleColumnDragOver={jest.fn()}
          handleColumnDrop={jest.fn()}
          setColumnWidths={jest.fn()}
          activeTableId={10}
          activeViewId={1}
          updateViewConfig={jest.fn()}
          setContextMenu={jest.fn()}
          setSelectedRow={jest.fn()}
          setShowDetailModal={jest.fn()}
          duplicateRow={jest.fn()}
          deleteRow={jest.fn()}
          addRow={jest.fn()}
          setShowNewFieldModal={jest.fn()}
          handleUpdateField={jest.fn()}
          setFieldContextMenu={jest.fn()}
        />
      )

      // When loading, card text is not visible
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument()

      // When loaded, card text is visible
      rerender(
        <DatabaseViewRouter
          currentView="kanban"
          fields={mockFields}
          hiddenFieldKeys={[]}
          displayRows={mockRows}
          gridLoading={false}
          readOnly={false}
          frozenColumnsCount={0}
          columnWidths={{}}
          sortField={null}
          sortOrder="asc"
          groupByField={null}
          editingFieldId={null}
          editingFieldName=""
          editingCell={null}
          editInputRef={{ current: null }}
          searchQuery=""
          filterRules={[]}
          groupedRows={{}}
          getRowBgColorClass={() => ''}
          updateCell={jest.fn()}
          toggleSort={jest.fn()}
          setEditingFieldId={jest.fn()}
          setEditingFieldName={jest.fn()}
          handleColumnDragStart={jest.fn()}
          handleColumnDragOver={jest.fn()}
          handleColumnDrop={jest.fn()}
          setColumnWidths={jest.fn()}
          activeTableId={10}
          activeViewId={1}
          updateViewConfig={jest.fn()}
          setContextMenu={jest.fn()}
          setSelectedRow={jest.fn()}
          setShowDetailModal={jest.fn()}
          duplicateRow={jest.fn()}
          deleteRow={jest.fn()}
          addRow={jest.fn()}
          setShowNewFieldModal={jest.fn()}
          handleUpdateField={jest.fn()}
          setFieldContextMenu={jest.fn()}
        />
      )

      expect(screen.getByText('Task 1')).toBeInTheDocument()
    })
  })
})
