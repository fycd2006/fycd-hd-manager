import React from 'react'
import GridView from '../table/GridView'
import GalleryView from './gallery/GalleryView'
import KanbanView from './kanban/KanbanView'
import CalendarView from './calendar/CalendarView'
import TimelineView from './timeline/TimelineView'
import FormView from './form/FormView'
import type { TableView, TableField, TableRow, ViewType, FilterRule } from '../../types'
import { formatDateValue } from '../../utils'

interface DatabaseViewRouterProps {
  currentView: ViewType
  fields: TableField[]
  hiddenFieldKeys: string[]
  displayRows: TableRow[]
  gridLoading: boolean
  readOnly: boolean
  frozenColumnsCount: number
  columnWidths: Record<string, number>
  sortField: string | null
  sortOrder: 'asc' | 'desc'
  groupByField: string | null
  editingFieldId: number | null
  editingFieldName: string
  editingCell: { rowId: number; fieldKey: string } | null
  editInputRef: React.RefObject<HTMLInputElement | null>
  searchQuery: string
  filterRules: FilterRule[]
  groupedRows: Record<string, TableRow[]>
  getRowBgColorClass: (row: TableRow) => string
  updateCell: (rowId: number, fieldKey: string, value: any) => Promise<void>
  toggleSort: (fieldKey: string) => void
  setEditingFieldId: (id: number | null) => void
  setEditingFieldName: (name: string) => void
  handleColumnDragStart: (e: React.DragEvent, fieldId: number) => void
  handleColumnDragOver: (e: React.DragEvent) => void
  handleColumnDrop: (e: React.DragEvent, targetFieldId: number) => void
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>
  activeTableId: number | null
  activeViewId: number | null
  updateViewConfig: (tableId: number, viewId: number, config: any) => void
  setContextMenu: (menu: any) => void
  setSelectedRow: (row: TableRow | null) => void
  setShowDetailModal: (show: boolean) => void
  duplicateRow: (rowToCopy: TableRow) => Promise<void>
  deleteRow: (rowId: number) => void
  addRow: () => void
  setShowNewFieldModal: (show: boolean) => void
  handleUpdateField: (fieldId: number, updates: Partial<TableField>) => void
  setFieldContextMenu: (menu: { field: TableField; x: number; y: number } | null) => void
}

export const DatabaseViewRouter: React.FC<DatabaseViewRouterProps> = ({
  currentView,
  fields,
  hiddenFieldKeys,
  displayRows,
  gridLoading,
  readOnly,
  frozenColumnsCount,
  columnWidths,
  sortField,
  sortOrder,
  groupByField,
  editingFieldId,
  editingFieldName,
  editingCell,
  editInputRef,
  searchQuery,
  filterRules,
  groupedRows,
  getRowBgColorClass,
  updateCell,
  toggleSort,
  setEditingFieldId,
  setEditingFieldName,
  handleColumnDragStart,
  handleColumnDragOver,
  handleColumnDrop,
  setColumnWidths,
  activeTableId,
  activeViewId,
  updateViewConfig,
  setContextMenu,
  setSelectedRow,
  setShowDetailModal,
  duplicateRow,
  deleteRow,
  addRow,
  setShowNewFieldModal,
  handleUpdateField,
  setFieldContextMenu,
}) => {
  return (
    <>
      {currentView === 'grid' && (
        <GridView
          visibleFields={fields.filter(f => !hiddenFieldKeys.includes(`field_${f.id}`))}
          displayRows={displayRows}
          gridLoading={gridLoading}
          readOnly={readOnly}
          onUpdateCell={updateCell}
          frozenColumnsCount={frozenColumnsCount}
          columnWidths={columnWidths}
          sortField={sortField}
          sortOrder={sortOrder}
          groupByField={groupByField}
          editingFieldId={editingFieldId}
          editingFieldName={editingFieldName}
          editingCell={editingCell}
          editInputRef={editInputRef}
          searchQuery={searchQuery}
          filterRules={filterRules}
          getFrozenLeftOffset={(idx: number) =>
            fields.slice(0, idx).reduce((sum, f) => sum + (columnWidths[`field_${f.id}`] || 150), 0)
          }
          getGroupedRows={() => groupedRows}
          getRowBgColorClass={getRowBgColorClass}
          renderCellContent={(row: TableRow, field: TableField) => {
            const val = row.data[`field_${field.id}`]
            if (val === null || val === undefined) return ''
            if (field.type === 'date') return formatDateValue(val)
            if (Array.isArray(val)) {
              return val.map((item, i) => (
                <span key={i} className="tag">
                  {typeof item === 'object' ? (item as any).value || (item as any).name : String(item)}
                </span>
              ))
            }
            if (typeof val === 'boolean') return val ? '✓' : ''
            return String(val)
          }}
          onToggleSort={toggleSort}
          onRenameField={(fieldId: number) => {
            setEditingFieldId(fieldId)
            const field = fields.find(f => f.id === fieldId)
            setEditingFieldName(field?.name || '')
          }}
          onSetEditingFieldId={setEditingFieldId}
          onSetEditingFieldName={setEditingFieldName}
          onHandleColumnDragStart={handleColumnDragStart}
          onHandleColumnDragOver={handleColumnDragOver}
          onHandleColumnDrop={handleColumnDrop}
          onHandleResizeStart={() => {}}
          onHandleResizeEnd={(fieldId: number, newWidth: number) => {
            const fieldKey = `field_${fieldId}`
            const nextWidths = { ...columnWidths, [fieldKey]: newWidth }
            setColumnWidths(nextWidths)
            if (activeViewId && activeTableId) {
              updateViewConfig(activeTableId, activeViewId, { columnWidths: nextWidths })
            }
          }}
          onSetContextMenu={setContextMenu}
          onExpandRow={(row: TableRow) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
          onDuplicateRow={duplicateRow}
          onDeleteRow={deleteRow}
          onAddRow={addRow}
          onShowNewFieldModal={() => setShowNewFieldModal(true)}
          onUpdateField={handleUpdateField}
          onOpenFieldContextMenu={(field, x, y) => setFieldContextMenu({ field, x, y })}
        />
      )}

      {currentView === 'gallery' && (
        <GalleryView
          rows={displayRows}
          fields={fields}
          onExpandRow={(row: any) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
        />
      )}

      {currentView === 'kanban' && (
        <KanbanView
          rows={displayRows}
          fields={fields}
          readOnly={readOnly}
          onExpandRow={(row: any) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
          onUpdateCell={updateCell}
        />
      )}

      {currentView === 'calendar' && (
        <CalendarView
          rows={displayRows}
          fields={fields}
          onExpandRow={(row: any) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
        />
      )}

      {currentView === 'timeline' && (
        <TimelineView
          rows={displayRows}
          fields={fields}
          onExpandRow={(row: any) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
        />
      )}

      {currentView === 'form' && (
        <FormView
          tableId={activeTableId || 0}
          tableName="Form View"
          fields={fields as any}
        />
      )}
    </>
  )
}
export default DatabaseViewRouter
