'use client'

import React from 'react'
import type { TableField, TableRow, FilterRule } from '@/modules/database/types'
import { GridView as GridViewContent, RowData } from '../views/grid/GridView'

interface GridViewProps {
  visibleFields: TableField[]
  displayRows: TableRow[]
  gridLoading: boolean
  frozenColumnsCount?: number
  columnWidths: Record<string, number>
  sortField?: string | null
  sortOrder?: 'asc' | 'desc'
  groupByField?: string | null
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
  onAddRow: () => void
  onShowNewFieldModal: () => void
  onUpdateCell?: (rowId: number, fieldKey: string, value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => void
  onOpenFieldContextMenu?: (field: TableField, x: number, y: number) => void
  onUndo?: () => void
  onRedo?: () => void
}

export default function GridView({
  visibleFields,
  displayRows,
  gridLoading,
  columnWidths,
  sortField,
  sortOrder,
  groupByField,
  readOnly = false,
  onAddRow,
  onShowNewFieldModal,
  onHandleResizeStart,
  onHandleResizeEnd,
  onUpdateCell,
  onUpdateField,
  onOpenFieldContextMenu,
  onExpandRow,
  onDeleteRow,
  onToggleSort,
  onUndo,
  onRedo,
  onHandleColumnDrop,
}: GridViewProps) {
  if (gridLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', width: '100%', padding: '32px' }}>
        <div style={{ width: '24px', height: '24px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // Convert fields to inner format
  const mappedFields: TableField[] = visibleFields.map(f => ({
    ...f,
    width: columnWidths[`field_${f.id}`] || f.width || 180
  }))

  // Convert rows to inner format
  const mappedRows: (RowData & { data: Record<string, any> })[] = displayRows.map(row => {
    const values: Record<number, any> = {}
    visibleFields.forEach(field => {
      const dataObj = row.data || {}
      const val = dataObj[`field_${field.id}`] ?? dataObj[field.id] ?? dataObj[String(field.id)] ?? null
      values[field.id] = val
    })
    return {
      id: row.id,
      values,
      data: row.data || {}
    }
  })

  const handleUpdateCell = (rowId: number, fieldId: number, value: any) => {
    if (readOnly) return
    if (onUpdateCell) {
      onUpdateCell(rowId, `field_${fieldId}`, value)
    }
  }

  const handleResizeColumn = (fieldId: number, newWidth: number) => {
    onHandleResizeStart(newWidth, fieldId)
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
    <div className="baserow-grid-view-wrapper" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <GridViewContent
        fields={mappedFields}
        rows={mappedRows}
        sortField={sortField}
        sortOrder={sortOrder}
        groupByField={groupByField}
        onUpdateCell={handleUpdateCell}
        onAddRow={readOnly ? () => {} : onAddRow}
        onAddField={readOnly ? () => {} : onShowNewFieldModal}
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
      />
    </div>
  )
}
