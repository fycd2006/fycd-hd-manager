'use client'

import React, { createContext, useContext } from 'react'
import type {
  TableField,
  TableRow,
  TableView,
  ViewType,
  FilterRule,
  SortRule,
  RowColorRule,
  GroupByRule,
  CellValue,
  DynamicTable,
} from '@/modules/database/types'

export interface TableContextValue {
  // Table state
  activeTableId: number | null
  activeTable: DynamicTable | null
  fields: TableField[]
  setFields: React.Dispatch<React.SetStateAction<TableField[]>>
  rows: TableRow[]
  setRows: (payload: TableRow[] | ((prev: TableRow[]) => TableRow[])) => void
  displayRows: TableRow[]
  groupedRows: Record<string, TableRow[]>
  gridLoading?: boolean
  readOnly?: boolean

  // View state & actions
  views: TableView[]
  activeViewId: number | null
  currentView: ViewType
  filterRules: FilterRule[]
  sortRules: SortRule[]
  hiddenFieldKeys: string[]
  rowColorRules: RowColorRule[]
  groupByRules: GroupByRule[]
  columnWidths: Record<string, number>
  saveViewConfig: (viewId: number, config: Partial<TableView>) => Promise<void>
  toggleSort: (fieldKey: string) => void
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>
  setFilterRules: (rules: FilterRule[]) => void
  setHiddenFieldKeys: (keys: string[]) => void
  setRowColorRules: (rules: RowColorRule[]) => void
  setGroupByRules: (rules: GroupByRule[]) => void
  createView: (name: string, type: ViewType) => Promise<void>

  // Row & Cell Operations
  updateCell: (
    rowId: number,
    fieldKeyOrId: string | number | Record<string, CellValue>,
    value?: CellValue,
    skipPushHistory?: boolean
  ) => Promise<void>
  batchUpdateCells: (updates: Array<{ rowId: number; data: Record<string, CellValue> }>) => Promise<void>
  addRow: (overrides?: Record<string, CellValue>) => Promise<void>
  batchAddRows: (rowsToCreate: Array<Record<string, CellValue>>) => Promise<void>
  deleteRow?: (rowId: number) => void
  batchDeleteRows?: (rowIds: number[]) => void
  duplicateRow?: (rowToCopy: TableRow) => Promise<void>
  fetchTableData: (tableId: number) => Promise<void>

  // Field Operations
  createField: () => Promise<void>
  deleteField: (fieldId: number) => Promise<void>
  handleUpdateField: (fieldId: number, updates: Partial<TableField>) => Promise<void>

  // Move Operations
  stageMoveRows: (rowIds: number[]) => void
  cancelMoveRows: () => void
  batchMoveRows: () => boolean

  // UI Selection & Modal Helper State
  selectedRow: TableRow | null
  setSelectedRow: (row: TableRow | null) => void
  showDetailModal: boolean
  setShowDetailModal: (show: boolean) => void
  showNewFieldModal: boolean
  setShowNewFieldModal: (show: boolean) => void
  fieldContextMenu: { field: TableField; x: number; y: number } | null
  setFieldContextMenu: (menu: { field: TableField; x: number; y: number } | null) => void
}

const TableContext = createContext<TableContextValue | null>(null)

export interface TableProviderProps {
  value: TableContextValue
  children: React.ReactNode
}

export function TableProvider({ value, children }: TableProviderProps) {
  return (
    <TableContext.Provider value={value}>
      {children}
    </TableContext.Provider>
  )
}

export function useTableContext(): TableContextValue {
  const context = useContext(TableContext)
  if (!context) {
    throw new Error('useTableContext must be used within a TableProvider')
  }
  return context
}

export function useOptionalTableContext(): TableContextValue | null {
  return useContext(TableContext)
}
