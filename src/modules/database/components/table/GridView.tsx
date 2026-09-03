'use client'

import React from 'react'
import type { TableField, TableRow, FilterRule, RowColorRule, GroupCollapseState, GroupByRule } from '@/modules/database/types'
import { GridView as GridViewContent, RowData } from '../views/grid/GridView'
import { WorkspaceGridSkeleton } from './WorkspaceGridSkeleton'

interface GridViewProps {
  visibleFields: TableField[]
  displayRows: TableRow[]
  gridLoading: boolean
  frozenColumnsCount?: number
  columnWidths: Record<string, number>
  sortField?: string | null
  sortOrder?: 'asc' | 'desc'
  sortRules?: any[]
  groupByField?: string | null
  groupByRules?: GroupByRule[]
  groupCollapseState?: GroupCollapseState
  onUpdateGroupCollapseState?: (state: GroupCollapseState | ((prev: GroupCollapseState) => GroupCollapseState)) => void
  rowColorRules?: RowColorRule[]
  editingFieldId?: number | null
  editingFieldName?: string
  editingCell?: { rowId: number; fieldKey: string } | null
  editInputRef?: React.RefObject<HTMLInputElement | null>
  searchQuery?: string
  filterRules?: FilterRule[]
  readOnly?: boolean
  
  // Callbacks
  getFrozenLeftOffset?: (fieldIndex: number) => number
  getGroupedRows?: () => Record<string, TableRow[]>
  getRowBgColorClass?: (row: TableRow) => string
  renderCellContent?: (row: TableRow, field: TableField) => React.ReactNode
  onToggleSort?: (fieldKey: string) => void
  onRenameField?: (fieldId: number) => void
  onSetEditingFieldId?: (fieldId: number | null) => void
  onSetEditingFieldName?: (name: string) => void
  onHandleColumnDragStart?: (e: React.DragEvent, fieldId: number) => void
  onHandleColumnDragOver?: (e: React.DragEvent) => void
  onHandleColumnDrop?: (e: React.DragEvent, targetFieldId: number) => void
  onHandleResizeStart: (e: React.MouseEvent | number, fieldId: number) => void
  onHandleResizeEnd?: (fieldId: number, newWidth: number) => void
  onSetContextMenu?: (menu: { x: number; y: number; fieldId: number; fieldName: string } | null) => void
  onExpandRow?: (row: TableRow) => void
  onDuplicateRow?: (row: TableRow) => void
  onDeleteRow?: (rowId: number) => void
  onAddRow?: () => void
  onShowNewFieldModal?: () => void
  onAddFieldPopover?: (pos: { top: number; left: number }) => void
  onUpdateCell?: (rowId: number, fieldKey: string, value: any) => void
  onBatchUpdateCells?: (updates: Array<{ rowId: number; data: Record<string, any> }>) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void
  onUndo?: () => Promise<boolean | void> | boolean | void
  onRedo?: () => Promise<boolean | void> | boolean | void
  onReorderRows?: (sourceRowIndex: number | number[], targetRowIndex: number) => void
  onBatchAddRows?: (rows: Array<Record<string, any>>) => void
  batchMoveRows?: (rowsToMove: Array<{ sourceRowId: number, data: Record<string, any> }>) => boolean
  stageMoveRows?: (rowIds: number[]) => void
  cancelMoveRows?: () => void
  isOffline?: boolean
  tableId?: number | null
  viewId?: number | null
  newFieldScrollTrigger?: number
  initialAggregations?: Record<string | number, string> | string | null
  onUpdateAggregations?: (agg: Record<string | number, string>) => void
}

export default function GridView({
  visibleFields,
  displayRows,
  gridLoading,
  columnWidths,
  sortField,
  sortOrder,
  sortRules,
  groupByField,
  groupByRules,
  groupCollapseState,
  onUpdateGroupCollapseState,
  rowColorRules,
  tableId,
  viewId,
  newFieldScrollTrigger,
  initialAggregations,
  onUpdateAggregations,
  readOnly = false,
  isOffline = false,
  onAddRow,
  onShowNewFieldModal,
  onAddFieldPopover,
  onHandleResizeStart,
  onHandleResizeEnd,
  onUpdateCell,
  onBatchUpdateCells,
  onUpdateField,
  onOpenFieldContextMenu,
  onExpandRow,
  onDeleteRow,
  onToggleSort,
  onUndo,
  onRedo,
  onHandleColumnDrop,
  onReorderRows,
  onBatchAddRows,
  batchMoveRows,
  stageMoveRows,
  cancelMoveRows,
}: GridViewProps) {
  if (gridLoading || visibleFields.length === 0) {
    return <WorkspaceGridSkeleton />
  }

  // Convert fields to inner format
  const mappedFields: TableField[] = visibleFields.map(f => ({
    ...f,
    width: columnWidths[`field_${f.id}`] || f.width || 180
  }))

  // Convert rows to inner format
  const mappedRows: (RowData & { data: Record<string, any> })[] = displayRows.map(row => {
    return {
      ...row,
      values: row.data || {},
      data: row.data || {},
    }
  })

  const handleUpdateCell = (rowId: number, fieldId: any, value: any) => {
    if (readOnly) return
    const fieldKey = typeof fieldId === 'string' && fieldId.startsWith('field_') ? fieldId : `field_${fieldId}`
    if (onUpdateCell) {
      onUpdateCell(rowId, fieldKey, value)
    }
  }

  const handleResizeColumn = (fieldId: number, newWidth: number) => {
    if (onHandleResizeStart) {
      onHandleResizeStart(newWidth, fieldId)
    }
  }

  const handleResizeColumnEnd = (fieldId: number, newWidth: number) => {
    if (onHandleResizeEnd) {
      onHandleResizeEnd(fieldId, newWidth)
    }
  }

  const handleExpandRow = (rowId: number) => {
    const targetRow = displayRows.find(r => r.id === rowId)
    if (targetRow && onExpandRow) {
      onExpandRow(targetRow)
    }
  }

  return (
    <div
      className="baserow-grid-view-wrapper"
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top seamless Animate UI Loading Shimmer Beam during refetch/switch */}
      {gridLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            zIndex: 9999,
            background: 'linear-gradient(90deg, transparent 0%, #52A628 35%, #EA580C 65%, transparent 100%)',
            backgroundSize: '200% 100%',
            boxShadow: '0 0 10px rgba(82, 166, 40, 0.45)',
            animation: 'fycdBarShimmer 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          opacity: gridLoading ? 0.75 : 1,
          transition: 'opacity 0.2s ease-out',
        }}
      >
        <GridViewContent
          fields={mappedFields}
          rows={mappedRows}
          sortField={sortField}
          sortOrder={sortOrder}
          sortRules={sortRules}
          groupByField={groupByField}
          groupByRules={groupByRules}
          rowColorRules={rowColorRules}
          onUpdateCell={handleUpdateCell}
          onBatchUpdateCells={readOnly ? undefined : onBatchUpdateCells}
          onAddRow={readOnly ? () => {} : onAddRow}
          onAddField={readOnly ? () => {} : onShowNewFieldModal}
          onAddFieldPopover={readOnly ? undefined : onAddFieldPopover}
          onResizeColumn={handleResizeColumn}
          onResizeColumnEnd={handleResizeColumnEnd}
          onExpandRow={handleExpandRow}
          onDeleteRow={readOnly ? undefined : onDeleteRow}
          onFieldClick={(field) => onToggleSort?.(`field_${field.id}`)}
          onOpenFieldContextMenu={readOnly ? undefined : onOpenFieldContextMenu}
          onUpdateField={readOnly ? undefined : onUpdateField}
          onUndo={onUndo}
          onRedo={onRedo}
          onReorderFields={(srcId, targetId) => (onHandleColumnDrop as any)?.(undefined, targetId, srcId)}
          onReorderRows={onReorderRows}
          onBatchAddRows={onBatchAddRows}
          batchMoveRows={batchMoveRows}
          stageMoveRows={stageMoveRows}
          cancelMoveRows={cancelMoveRows}
          isOffline={isOffline}
          tableId={tableId}
          viewId={viewId}
          newFieldScrollTrigger={newFieldScrollTrigger}
          initialAggregations={initialAggregations}
          onUpdateAggregations={onUpdateAggregations}
          groupCollapseState={groupCollapseState}
          onUpdateGroupCollapseState={onUpdateGroupCollapseState}
        />
      </div>
    </div>
  )
}
