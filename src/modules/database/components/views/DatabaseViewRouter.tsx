import React from 'react'
import GridView from '../table/GridView'
import GalleryView from './gallery/GalleryView'
import KanbanView from './kanban/KanbanView'
import CalendarView from './calendar/CalendarView'
import TimelineView from './timeline/TimelineView'
import FormView from './form/FormView'
import type { TableView, TableField, TableRow, ViewType, FilterRule, RowColorRule, GroupCollapseState, GroupByRule } from '../../types'
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
  sortRules?: SortRule[]
  groupByField: string | null
  groupByRules?: GroupByRule[]
  groupCollapseState?: GroupCollapseState
  onUpdateGroupCollapseState?: (state: GroupCollapseState | ((prev: GroupCollapseState) => GroupCollapseState)) => void
  rowColorRules?: RowColorRule[]
  editingFieldId: number | null
  editingFieldName: string
  editingCell: { rowId: number; fieldKey: string } | null
  editInputRef: React.RefObject<HTMLInputElement | null>
  searchQuery: string
  filterRules: FilterRule[]
  groupedRows: Record<string, TableRow[]>
  getRowBgColorClass: (row: TableRow) => string
  updateCell: (rowId: number, fieldKey: string, value: any) => Promise<void>
  batchUpdateCells?: (updates: Array<{ rowId: number; data: Record<string, any> }>) => Promise<void>
  toggleSort: (fieldKey: string) => void
  setEditingFieldId: (id: number | null) => void
  setEditingFieldName: (name: string) => void
  handleColumnDragStart: (e: React.DragEvent, fieldId: number) => void
  handleColumnDragOver: (e: React.DragEvent) => void
  handleColumnDrop: (e: React.DragEvent, targetFieldId: number) => void
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>
  activeTableId: number | null
  activeViewId: number | null
  views?: TableView[]
  updateViewConfig: (viewId: number, config: any) => Promise<void> | void
  setContextMenu: (menu: any) => void
  setSelectedRow: (row: TableRow | null) => void
  setShowDetailModal: (show: boolean) => void
  duplicateRow: (rowToCopy: TableRow) => Promise<void>
  deleteRow: (rowId: number) => void
  batchDeleteRows?: (rowIds: number[]) => void
  addRow: () => void
  batchAddRows?: (rowsToCreate: Array<Record<string, any>>) => void
  setShowNewFieldModal: (show: boolean) => void
  onAddFieldPopover?: (pos: { top: number; left: number }) => void
  handleUpdateField: (fieldId: number, updates: Partial<TableField>) => void
  setFieldContextMenu: (menu: { field: TableField; x: number; y: number } | null) => void
  onUndo?: () => void
  onRedo?: () => void
  onReorderRows?: (sourceRowIndex: number, targetRowIndex: number) => void
  batchMoveRows?: (rowsToMove: Array<{ sourceRowId: number, data: Record<string, any> }>) => boolean
  stageMoveRows?: (rowIds: number[]) => void
  cancelMoveRows?: () => void
  isOffline?: boolean
}

export const DatabaseViewRouter: React.FC<DatabaseViewRouterProps> = ({
  currentView,
  fields,
  hiddenFieldKeys,
  displayRows,
  gridLoading,
  readOnly,
  isOffline,
  frozenColumnsCount,
  columnWidths,
  sortField,
  sortOrder,
  sortRules,
  groupByField,
  groupByRules,
  groupCollapseState,
  onUpdateGroupCollapseState,
  rowColorRules,
  editingFieldId,
  editingFieldName,
  editingCell,
  editInputRef,
  searchQuery,
  filterRules,
  groupedRows,
  getRowBgColorClass,
  updateCell,
  batchUpdateCells,
  toggleSort,
  setEditingFieldId,
  setEditingFieldName,
  handleColumnDragStart,
  handleColumnDragOver,
  handleColumnDrop,
  setColumnWidths,
  activeTableId,
  activeViewId,
  views,
  updateViewConfig,
  setContextMenu,
  setSelectedRow,
  setShowDetailModal,
  duplicateRow,
  deleteRow,
  batchDeleteRows,
  addRow,
  batchAddRows,
  setShowNewFieldModal,
  onAddFieldPopover,
  handleUpdateField,
  setFieldContextMenu,
  onUndo,
  onRedo,
  onReorderRows,
  batchMoveRows,
  stageMoveRows,
  cancelMoveRows,
}) => {
  const activeView = views?.find(v => v.id === activeViewId)

  return (
    <div key={currentView} className="w-full h-full animate-in fade-in duration-200 ease-out">
      {currentView === 'grid' && (
        <GridView
          tableId={activeTableId}
          viewId={activeViewId}
          initialAggregations={activeView?.aggregations}
          onUpdateAggregations={(newAggregations) => {
            if (activeViewId) {
              updateViewConfig(activeViewId, { aggregations: newAggregations })
            }
          }}
          visibleFields={fields.filter(f => !hiddenFieldKeys.includes(`field_${f.id}`))}
          displayRows={displayRows}
          gridLoading={gridLoading}
          readOnly={readOnly}
          isOffline={isOffline}
          onUpdateCell={updateCell}
          onBatchUpdateCells={batchUpdateCells}
          onBatchAddRows={batchAddRows}
          frozenColumnsCount={frozenColumnsCount}
          columnWidths={columnWidths}
          sortField={sortField}
          sortOrder={sortOrder}
          sortRules={sortRules}
          groupByField={groupByField}
          groupByRules={groupByRules}
          groupCollapseState={groupCollapseState}
          onUpdateGroupCollapseState={onUpdateGroupCollapseState}
          rowColorRules={rowColorRules}
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
            if (activeViewId) {
              updateViewConfig(activeViewId, { columnWidths: nextWidths })
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
          onAddFieldPopover={onAddFieldPopover}
          onUpdateField={handleUpdateField}
          onOpenFieldContextMenu={(field, x, y) => setFieldContextMenu({ field, x, y })}
          onUndo={onUndo}
          onRedo={onRedo}
          onReorderRows={onReorderRows}
          batchMoveRows={batchMoveRows}
          stageMoveRows={stageMoveRows}
          cancelMoveRows={cancelMoveRows}
        />
      )}

      {currentView === 'gallery' && (
        <GalleryView
          rows={displayRows}
          fields={fields}
          loading={gridLoading}
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
          loading={gridLoading}
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
          loading={gridLoading}
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
          loading={gridLoading}
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
          loading={gridLoading}
        />
      )}
    </div>
  )
}
export default DatabaseViewRouter
