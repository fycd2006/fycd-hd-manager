/**
 * Database Module - Type Definitions
 * Centralized types for all database-related entities
 */

// =============================================
// User & Authentication
// =============================================
export interface User {
  id: number
  username: string
  email: string
  role: string
}

// =============================================
// Workspace & Database Hierarchy
// =============================================
export interface DynamicTable {
  id: number
  name: string
  order: number
  databaseId: number | null
  _count?: { rows: number }
}

export interface Database {
  id: number
  name: string
  workspaceId: number
  tables: DynamicTable[]
}

export interface Workspace {
  id: number
  name: string
  databases: Database[]
  members?: { userId: number; role: string }[]
}

// =============================================
// Table Fields & Rows
// =============================================
export interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
  options: string | null
  width?: number
}

export interface TableRow {
  id: number
  tableId: number
  data: Record<string, CellValue>
  order: number
  createdAt: string
}

// =============================================
// Cell & Data Types
// =============================================
export type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

// =============================================
// Views
// =============================================
export type ViewType = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form'
export type SortOrder = 'asc' | 'desc'

export interface TableView {
  id: number
  tableId: number
  name: string
  type: ViewType
  filters: string | null
  sortField: string | null
  sortOrder: SortOrder | null
  hiddenFields: string | null
  columnWidths?: string | null
  groupByField?: string | null
  rowColors: string | null
}

export type ViewConfigPatch = {
  type?: ViewType
  filters?: FilterRule[] | string | null
  sortField?: string | null
  sortOrder?: SortOrder | null
  hiddenFields?: string[] | string | null
  columnWidths?: Record<string, number> | string | null
  groupByField?: string | null
  rowColors?: RowColorRule[] | string | null
}

// =============================================
// Filters & Sorting
// =============================================
export interface FilterRule {
  fieldKey: string
  operator: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'empty' | 'not_empty'
  value: string
}

export interface RowColorRule {
  fieldKey: string
  operator: 'equals' | 'contains'
  value: string
  color: 'red' | 'green' | 'blue' | 'yellow' | 'none'
}

// =============================================
// UI Components
// =============================================
export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export interface ContextMenu {
  x: number
  y: number
  fieldId: number
  fieldName: string
}

// =============================================
// Activity & Collaboration
// =============================================
export type ActivityLogEntry = { id?: string; content?: string; user?: string; time?: string }
export type CollaboratorUser = { id: number; username?: string }
export type AttachmentFile = { url?: string; name?: string }

// =============================================
// Trash/Recycle Bin
// =============================================
export interface TrashItems {
  fields: TableField[]
  rows: TableRow[]
}

// =============================================
// Cell Editing State
// =============================================
export interface EditingCellState {
  rowId: number
  fieldKey: string
}

export interface EditingFieldState {
  fieldId: number
  fieldName: string
}

// =============================================
// Theme
// =============================================
export type Theme = 'dark' | 'light'

export interface DarkReaderSettings {
  brightness: number
  contrast: number
  sepia: number
  grayscale: number
}

// =============================================
// Modal States
// =============================================
export interface WorkspaceModalState {
  show: boolean
  wsId: number | null
  name: string
}

export interface DatabaseModalState {
  show: boolean
  dbId: number | null
  name: string
}

export interface RenameModalState {
  show: boolean
  type: 'workspace' | 'database' | 'table' | null
  id: number | null
  name: string
}

export interface NewFieldModalState {
  show: boolean
  name: string
  type: string
  options: string
  targetTableId: number | null
  relationFieldId: number | null
  targetFieldId: number | null
  rollupFunction: string
}

export interface NewViewModalState {
  show: boolean
  name: string
  type: ViewType
}

// =============================================
// Activity Log
// =============================================
export interface LogCellState {
  rowId: number
  fieldKey: string
}

export interface LogEditingState {
  id: string | null
  content: string
}

// =============================================
// Column Configuration
// =============================================
export interface ColumnConfig {
  hiddenFields: string[]
  columnWidths: Record<string, number>
  frozenCount: number
}
