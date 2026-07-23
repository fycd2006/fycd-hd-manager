'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import DatabaseViewRouter from '@/modules/database/components/views/DatabaseViewRouter'
import GlobalModalsContainer from '@/modules/database/components/modals/GlobalModalsContainer'
import useTableCSV from '@/modules/database/hooks/useTableCSV'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { PanelLeft, PanelLeftClose, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, AlignJustify, Search } from 'lucide-react'
import { ViewToolbar } from '@/modules/database/components/toolbar/ViewToolbar'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { AuthScreen } from '@/modules/database/components/auth'
import Sidebar from '@/modules/database/components/sidebar/Sidebar'
import { WorkspaceModal, DatabaseModal, RenameModal, ViewModal, FieldModal, TableModal } from '@/modules/database/components/modals/Modals'
import MembersModal from '@/modules/database/components/modals/MembersModal'
import NotificationsModal from '@/modules/database/components/modals/NotificationsModal'
import UserSettingsModal from '@/modules/database/components/modals/UserSettingsModal'
import SubscriptionModal from '@/modules/database/components/modals/SubscriptionModal'
import DarkReaderModal from '@/modules/database/components/modals/DarkReaderModal'
import { getRolePermissions } from '@/lib/permissions'
import GridView from '@/modules/database/components/table/GridView'
import { FieldContextMenu } from '@/modules/database/components/menu/FieldContextMenu'
import { FIELD_TYPE_ICONS, FIELD_TYPE_LABELS, Icons } from '@/modules/database/constants'
const getViewIcon = (type: string, props: any) => {
  switch(type) {
    case 'kanban': return <Kanban {...props} />;
    case 'gallery': return <LayoutTemplate {...props} />;
    case 'calendar': return <Calendar {...props} />;
    case 'timeline': return <Clock {...props} />;
    case 'form': return <FormInput {...props} />;
    default: return <LayoutGrid {...props} />;
  }
}

// ============================================
// New Architecture Imports
// ============================================
import { 
  useAuthStore, 
  useThemeStore, 
  useWorkspaceStore, 
  useUIStore 
} from '@/modules/database/store'
import * as workspaceService from '@/modules/database/services/workspace'
import * as fieldService from '@/modules/database/services/field'
import * as rowService from '@/modules/database/services/row'
import * as viewService from '@/modules/database/services/view'
import * as userService from '@/modules/database/services/user'
import * as trashService from '@/modules/database/services/trash'
import { exportToCSV, parseCSVFile, csvRowToTableRow } from '@/modules/database/utils/csv'
import type { 
  User, 
  Workspace, 
  Database, 
  DynamicTable, 
  TableField, 
  TableRow, 
  CellValue, 
  ViewType, 
  SortOrder, 
  ViewConfigPatch, 
  TableView, 
  Toast, 
  ContextMenu, 
  FilterRule, 
  RowColorRule 
} from '@/modules/database/types'

export default function Home() {
  // ============================================
  // Use Modular Stores (Baserow Architecture)
  // ============================================
  const [authState, authActions] = useAuthStore()
  const [themeState, themeActions] = useThemeStore()
  const [wsState, wsActions] = useWorkspaceStore()
  const [uiState, uiActions] = useUIStore()

  // ============================================
  // Local UI State (Not yet extracted to stores)
  // ============================================
  const [fields, setFields] = useState<TableField[]>([])
  const [rows, setRows] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(false)
  
  // View configuration
  const [views, setViews] = useState<TableView[]>([])
  const [currentView, setCurrentView] = useState<ViewType>('grid')
  const [showNewViewModal, setShowNewViewModal] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [newViewType, setNewViewType] = useState<ViewType>('grid')
  
  // Editing states
  const [editingCell, setEditingCell] = useState<{ rowId: number; fieldKey: string } | null>(null)
  const [editingCellValue, setEditingCellValue] = useState('')
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null)
  const [editingFieldName, setEditingFieldName] = useState('')
  
  // Sort & Filter
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterRules, setFilterRules] = useState<FilterRule[]>([])
  
  // Hidden Fields & Row Colors Config
  const [hiddenFieldKeys, setHiddenFieldKeys] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [showHiddenFieldsPanel, setShowHiddenFieldsPanel] = useState(false)
  const [rowColorRules, setRowColorRules] = useState<RowColorRule[]>([])
  const [showRowColorsPanel, setShowRowColorsPanel] = useState(false)
  const [showGroupByPanel, setShowGroupByPanel] = useState(false)
  const [groupByField, setGroupByField] = useState<string | null>(null)
  
  // Modals
  const [showNewFieldModal, setShowNewFieldModal] = useState(false)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [newFieldTargetTableId, setNewFieldTargetTableId] = useState<number | null>(null)
  
  // Lookup / Rollup options
  const [newFieldRelationFieldId, setNewFieldRelationFieldId] = useState<number | null>(null)
  const [newFieldTargetFieldId, setNewFieldTargetFieldId] = useState<number | null>(null)
  const [newFieldRollupFunction, setNewFieldRollupFunction] = useState('sum')
  const [targetTableFields, setTargetTableFields] = useState<TableField[]>([])
  
  // Expand detail view modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [fieldContextMenu, setFieldContextMenu] = useState<{ field: TableField; x: number; y: number } | null>(null)
  const [editingFieldForModal, setEditingFieldForModal] = useState<TableField | null>(null)
  
  const [authError, setAuthError] = useState<string | null>(null)
  const [draggedFieldId, setDraggedFieldId] = useState<number | null>(null)
  
  // Edit Input Ref
  const editInputRef = useRef<HTMLInputElement>(null)
  
  // Other UI state
  const [frozenColumnsCount, setFrozenColumnsCount] = useState<number>(1)
  const [autoInherit, setAutoInherit] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)
  const [workspaceMemberCount, setWorkspaceMemberCount] = useState<number>(1)
  const [systemUsers, setSystemUsers] = useState<User[]>([])

  useEffect(() => {
    if (authState.currentUser) {
      fetch('/api/notifications')
        .then(res => res.ok ? res.json() : { notifications: [] })
        .then(data => {
          const unread = (data.notifications || []).filter((n: any) => !n.read).length
          setUnreadNotificationsCount(unread)
        })
        .catch(() => {})
    }
  }, [authState.currentUser, showNotificationsModal])
  
  // Rename modal states
  const [renameType, setRenameType] = useState<'workspace' | 'database' | 'table' | null>(null)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameNameValue, setRenameNameValue] = useState('')
  const [rowHeightSize, setRowHeightSize] = useState<'small' | 'medium' | 'large' | 'extra'>('small')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [modalDbIdForTable, setModalDbIdForTable] = useState<number | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (editingFieldId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingFieldId])

  // Close context menu on global click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const menuEl = document.querySelector('.context-menu')
      if (menuEl && menuEl.contains(e.target as Node)) {
        return
      }
      setContextMenu(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null)
      }
    }
    window.addEventListener('click', handleGlobalClick, true)
    window.addEventListener('mousedown', handleGlobalClick, true)
    window.addEventListener('contextmenu', handleGlobalClick, true)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick, true)
      window.removeEventListener('mousedown', handleGlobalClick, true)
      window.removeEventListener('contextmenu', handleGlobalClick, true)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Initialize authentication using new store
  useEffect(() => {
    authActions.checkAuth()
  }, [authActions])

  // Load workspaces when authenticated using new store
  useEffect(() => {
    if (authState.currentUser) {
      wsActions.fetchWorkspaces()
    }
  }, [authState.currentUser, wsActions])

  // Undo / Redo Hook
  const updateCellRef = useRef<(rowId: number, fieldKey: string, value: CellValue, skipPushHistory?: boolean) => Promise<void>>(async () => {})

  const { pushEdit, undo, redo, canUndo, canRedo } = useUndoRedo(
    async (rowId, fieldKey, val) => {
      await updateCellRef.current(rowId, fieldKey, val, true)
    }
  )

  // Fetch table data using new services
  const fetchTableData = useCallback(async (tableId: number) => {
    setGridLoading(true)
    try {
      const [fieldsData, rowsData] = await Promise.all([
        fieldService.fetchFields(tableId),
        rowService.fetchRows(tableId),
      ])
      setFields(fieldsData)
      setRows(rowsData)
      console.log('Table data loaded:', { fields: fieldsData.length, rows: rowsData.length })
      
      // Load views
      fetchViews(tableId)
    } catch (error) {
      console.error('Failed to load table data:', error)
      uiActions.addToast('無法載入資料表內容', 'error')
    } finally {
      setGridLoading(false)
    }
  }, [uiActions])

  // CSV Hook
  const { csvInputRef, handleExportCSV, handleCSVImport } = useTableCSV({
    activeTableId: wsState.activeTableId,
    fields,
    rows,
    hiddenFieldKeys,
    workspaces: wsState.workspaces,
    setFields,
    setGridLoading,
    fetchTableData,
    addToast: uiActions.addToast,
  })

  const fetchViews = useCallback(async (tableId: number) => {
    try {
      const data = await viewService.fetchViews(tableId)
      console.log('Views loaded:', data)
      if (Array.isArray(data) && data.length > 0) {
        setViews(data)
        const firstView = data[0]
        wsActions.setActiveViewId(firstView.id)
        applyViewConfig(firstView)
      } else {
        // If no views exist, create a default grid view
        setCurrentView('grid')
      }
    } catch (error) {
      console.error('Failed to load views:', error)
      setCurrentView('grid')
    }
  }, [wsActions])

  // Load table data when activeTableId changes
  useEffect(() => {
    if (wsState.activeTableId) {
      fetchTableData(wsState.activeTableId)
    }
  }, [wsState.activeTableId, fetchTableData])

  const applyViewConfig = (view: TableView) => {
    setCurrentView(view.type)
    setSortField(view.sortField)
    setSortOrder(view.sortOrder || 'asc')

    try {
      const parsedFilters = view.filters ? JSON.parse(view.filters) : []
      setFilterRules(Array.isArray(parsedFilters) ? parsedFilters : [])
    } catch {
      setFilterRules([])
    }

    try {
      const parsedHidden = view.hiddenFields ? JSON.parse(view.hiddenFields) : []
      setHiddenFieldKeys(parsedHidden)
    } catch {
      setHiddenFieldKeys([])
    }

    try {
      const parsedColors = view.rowColors ? JSON.parse(view.rowColors) : []
      setRowColorRules(parsedColors)
    } catch {
      setRowColorRules([])
    }

    try {
      const parsedWidths = view.columnWidths ? JSON.parse(view.columnWidths) : {}
      setColumnWidths(parsedWidths)
    } catch {
      setColumnWidths({})
    }

    setGroupByField(view.groupByField || null)
  }

  // Cell update using new service
  const updateCell = async (rowId: number, fieldKey: string, value: CellValue, skipPushHistory: boolean = false) => {
    if (!wsState.activeTableId) return
    try {
      const fieldId = parseInt(fieldKey.replace('field_', ''))
      const field = fields.find(f => f.id === fieldId)
      
      let payloadValue = value
      if ((field?.type === 'link_row' || field?.type === 'collaborator') && Array.isArray(value)) {
        payloadValue = value.map(item => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            return (item as any).id
          }
          return item
        })
      }

      const targetRow = rows.find(r => r.id === rowId)
      const oldValue = targetRow ? targetRow.data[fieldKey] : null

      // Optimistically update UI state immediately (preserving object values for tags)
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldKey]: value } } : r))

      const result = await rowService.updateCell(wsState.activeTableId, rowId, fieldKey, payloadValue)
      
      if (result.ok) {
        if (!skipPushHistory) {
          pushEdit({
            rowId,
            fieldKey,
            before: oldValue,
            after: payloadValue
          })
        }
      } else {
        // Revert on error
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldKey]: oldValue } } : r))
        uiActions.addToast('更新儲存格失敗', 'error')
      }
    } catch {
      uiActions.addToast('更新儲存格失敗', 'error')
    }
  }

  useEffect(() => {
    updateCellRef.current = updateCell
  }, [updateCell])

  // Add row using new service
  const addRow = async () => {
    if (!wsState.activeTableId) return
    try {
      let baseData: Record<string, CellValue> = {}
      if (autoInherit && rows.length > 0) {
        const lastRow = rows[rows.length - 1]
        baseData = { ...lastRow.data }
        
        fields.forEach(f => {
          const key = `field_${f.id}`
          if (['created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'lookup', 'rollup', 'formula'].includes(f.type)) {
            delete baseData[key]
          }
        })
      } else {
        fields.forEach(f => {
          const key = `field_${f.id}`
          switch (f.type) {
            case 'boolean': baseData[key] = false; break
            case 'number': baseData[key] = null; break
            case 'link_row': baseData[key] = []; break
            case 'multiple_select': baseData[key] = []; break
            default: baseData[key] = ''
          }
        })
      }

      const result = await rowService.createRow(wsState.activeTableId, baseData)
      if (result.ok && result.row) {
        setRows(prev => [...prev, result.row!])
        
        if (fields.length > 0) {
          const firstKey = `field_${fields[0].id}`
          setEditingCell({ rowId: result.row!.id, fieldKey: firstKey })
          setEditingCellValue('')
        }
      }
    } catch {
      uiActions.addToast('新增列失敗', 'error')
    }
  }

  // Reorder rows (Drag & Drop with DB persistence)
  const handleReorderRows = async (srcIdx: number, targetIdx: number) => {
    if (!wsState.activeTableId || srcIdx === targetIdx) return
    const sourceRow = displayRows[srcIdx]
    const targetRow = displayRows[targetIdx]
    if (!sourceRow || !targetRow) return

    const realSrcIdx = rows.findIndex(r => r.id === sourceRow.id)
    const realTargetIdx = rows.findIndex(r => r.id === targetRow.id)
    if (realSrcIdx === -1 || realTargetIdx === -1) return

    const reordered = [...rows]
    const [moved] = reordered.splice(realSrcIdx, 1)
    reordered.splice(realTargetIdx, 0, moved)

    const updatedRows = reordered.map((r, idx) => ({ ...r, order: idx }))
    setRows(updatedRows)

    const rowIds = updatedRows.map(r => r.id)
    try {
      const res = await rowService.reorderRows(wsState.activeTableId, rowIds)
      if (res.ok) {
        uiActions.addToast('已儲存資料列順序', 'success')
      } else {
        uiActions.addToast(res.error || '儲存資料列順序失敗', 'error')
      }
    } catch {
      uiActions.addToast('儲存資料列順序失敗', 'error')
    }
  }

  // Delete row using new service
  const deleteRow = async (rowId: number) => {
    if (!wsState.activeTableId) return
    try {
      const result = await rowService.deleteRow(wsState.activeTableId, rowId)
      if (result.ok) {
        setRows(prev => prev.filter(r => r.id !== rowId))
        uiActions.addToast('資料列已刪除', 'success')
      }
    } catch {
      uiActions.addToast('刪除列失敗', 'error')
    }
  }

  // Duplicate row using new service
  const duplicateRow = async (rowToCopy: TableRow) => {
    if (!wsState.activeTableId) return
    try {
      const copiedData = { ...rowToCopy.data }
      fields.forEach(f => {
        const key = `field_${f.id}`
        if (['created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'lookup', 'rollup', 'formula'].includes(f.type)) {
          delete copiedData[key]
        }
      })

      const result = await rowService.createRow(wsState.activeTableId, copiedData)
      if (result.ok && result.row) {
        setRows(prev => [...prev, result.row!])
        uiActions.addToast('已複製該列資料並新增為新列', 'success')
      }
    } catch {
      uiActions.addToast('複製列資料失敗', 'error')
    }
  }



  // Helper to extract cell value regardless of key format (field_1 vs 1 vs "1")
  const getCellValue = (row: TableRow, fieldKeyOrId: string) => {
    if (!row || !row.data) return ''
    const cleanId = String(fieldKeyOrId).replace('field_', '')
    return (
      row.data[`field_${cleanId}`] ??
      row.data[cleanId] ??
      row.data[Number(cleanId)] ??
      ''
    )
  }

  const frozenDisplayRowsRef = useRef<TableRow[] | null>(null)

  useEffect(() => {
    if (!editingCell) {
      frozenDisplayRowsRef.current = null
    }
  }, [editingCell])

  // Get display rows with filters and sorting
  const getDisplayRows = () => {
    let result = [...rows]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(row =>
        Object.values(row.data || {}).some(v => {
          if (Array.isArray(v)) {
            return v.some(item => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                return String((item as any).value || (item as any).name || '').toLowerCase().includes(q)
              }
              return String(item).toLowerCase().includes(q)
            })
          }
          return String(v ?? '').toLowerCase().includes(q)
        })
      )
    }

    // Advanced filters
    if (Array.isArray(filterRules) && filterRules.length > 0) {
      result = result.filter(row => {
        return filterRules.every(rule => {
          const val = getCellValue(row, rule.fieldKey)
          let textVal = String(val ?? '')
          if (Array.isArray(val)) {
            textVal = val.map(item => {
              if (item && typeof item === 'object' && !Array.isArray(item)) {
                return (item as any).value || (item as any).name || ''
              }
              return String(item)
            }).join(', ')
          }
          
          const ruleVal = rule.value.toLowerCase()
          const cellVal = textVal.toLowerCase()

          switch (rule.operator) {
            case 'contains': return cellVal.includes(ruleVal)
            case 'not_contains': return !cellVal.includes(ruleVal)
            case 'equals': return cellVal === ruleVal
            case 'not_equals': return cellVal !== ruleVal
            case 'empty': return cellVal === '' || cellVal === 'null' || cellVal === 'undefined'
            case 'not_empty': return cellVal !== '' && cellVal !== 'null' && cellVal !== 'undefined'
            default: return true
          }
        })
      })
    }

    // Defer re-sorting if a cell is currently being edited
    if (editingCell && frozenDisplayRowsRef.current && frozenDisplayRowsRef.current.length > 0) {
      const rowMap = new Map(result.map(r => [r.id, r]))
      const updatedFrozenList: TableRow[] = []
      frozenDisplayRowsRef.current.forEach(fRow => {
        const latest = rowMap.get(fRow.id)
        if (latest) {
          updatedFrozenList.push(latest)
          rowMap.delete(fRow.id)
        }
      })
      rowMap.forEach(newRow => updatedFrozenList.push(newRow))
      return updatedFrozenList
    }

    // Sort when not editing
    if (sortField) {
      result.sort((a, b) => {
        const va = getCellValue(a, sortField)
        const vb = getCellValue(b, sortField)
        const numA = Number(va)
        const numB = Number(vb)
        if (!isNaN(numA) && !isNaN(numB) && va !== '' && vb !== '') {
          return sortOrder === 'asc' ? numA - numB : numB - numA
        }
        return sortOrder === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      })
    }

    frozenDisplayRowsRef.current = result
    return result
  }

  const displayRows = getDisplayRows()

  // Get row background color
  const getRowBgColorClass = (row: TableRow) => {
    if (rowColorRules.length === 0) return ''
    const matched = rowColorRules.find(rule => {
      const val = row.data[rule.fieldKey]
      const textVal = String(val ?? '').toLowerCase()
      const matchVal = rule.value.toLowerCase()

      if (rule.operator === 'equals') {
        return textVal === matchVal
      } else if (rule.operator === 'contains') {
        return textVal.includes(matchVal)
      }
      return false
    })
    return matched ? `row-color-${matched.color}` : ''
  }

  // Get grouped rows
  const getGroupedRows = () => {
    if (!groupByField) return { '': displayRows }
    const groups: Record<string, TableRow[]> = {}
    displayRows.forEach(row => {
      const rawVal = row.data[groupByField]
      let groupKey = '（空白）'
      if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
        if (typeof rawVal === 'boolean') {
          groupKey = rawVal ? '是 (Yes)' : '否 (No)'
        } else if (Array.isArray(rawVal)) {
          groupKey = rawVal.map(u => (u as any).username || (u as any).value || String((u as any).id)).join(', ') || '（空白）'
        } else if (typeof rawVal === 'object') {
          groupKey = (rawVal as any).value || (rawVal as any).username || String((rawVal as any).id) || '（空白）'
        } else {
          groupKey = String(rawVal)
        }
      }
      if (!groups[groupKey]) groups[groupKey] = []
      groups[groupKey].push(row)
    })
    return groups
  }

  const groupedRows = getGroupedRows()

  // Column drag and drop
  const handleColumnDragStart = (e: React.DragEvent, fieldId: number) => {
    setDraggedFieldId(fieldId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleColumnDrop = async (e: React.DragEvent | undefined, targetFieldId: number, sourceFieldId?: number) => {
    e?.preventDefault?.()
    const fromId = sourceFieldId ?? draggedFieldId
    if (fromId === null || fromId === undefined || fromId === targetFieldId || !wsState.activeTableId) return

    const draggedIndex = fields.findIndex(f => f.id === fromId)
    const targetIndex = fields.findIndex(f => f.id === targetFieldId)

    if (draggedIndex === -1 || targetIndex === -1) return
    if (draggedIndex === 0 || targetIndex === 0) {
      uiActions.addToast('主要欄位（第一順位欄位）位置已被鎖定，無法搬移或替代', 'error')
      setDraggedFieldId(null)
      return
    }

    const reorderedFields = [...fields]
    const [draggedField] = reorderedFields.splice(draggedIndex, 1)
    reorderedFields.splice(targetIndex, 0, draggedField)

    const fieldOrders = reorderedFields.map((f, index) => f.id)

    setFields(reorderedFields.map((f, index) => ({ ...f, order: index })))
    setDraggedFieldId(null)

    try {
      await fieldService.reorderFields(wsState.activeTableId, fieldOrders)
      uiActions.addToast('已儲存欄位順序', 'success')
    } catch {
      uiActions.addToast('儲存欄位順序失敗', 'error')
    }
  }

  // Column resizing is handled internally by GridViewHead, but we sync state and backend
  // toggle sort
  const toggleSort = (fieldKey: string) => {
    let nextOrder: 'asc' | 'desc' = 'asc'
    let nextField: string | null = fieldKey

    if (sortField === fieldKey) {
      if (sortOrder === 'asc') {
        nextOrder = 'desc'
      } else {
        nextField = null
        nextOrder = 'asc'
      }
    }

    setSortField(nextField)
    setSortOrder(nextOrder)

    if (wsState.activeViewId) {
      viewService.updateViewConfig(wsState.activeTableId!, wsState.activeViewId, { sortField: nextField, sortOrder: nextOrder })
    }
  }

  // Toggle field visibility
  const toggleFieldVisibility = (fieldKey: string) => {
    let nextHidden: string[]
    if (hiddenFieldKeys.includes(fieldKey)) {
      nextHidden = hiddenFieldKeys.filter(k => k !== fieldKey)
    } else {
      nextHidden = [...hiddenFieldKeys, fieldKey]
    }
    setHiddenFieldKeys(nextHidden)
    if (wsState.activeViewId) {
      viewService.updateViewConfig(wsState.activeTableId!, wsState.activeViewId, { hiddenFields: nextHidden })
    }
  }

  // Field CRUD using new services
  const createField = async () => {
    if (!newFieldName.trim() || !wsState.activeTableId) return
    try {
      let parsedOptions: any = null
      if ((newFieldType === 'single_select' || newFieldType === 'multiple_select') && newFieldOptions.trim()) {
        parsedOptions = { choices: newFieldOptions.split(',').map(c => c.trim()).filter(Boolean) }
      } else if (newFieldType === 'link_row' && newFieldTargetTableId) {
        parsedOptions = { targetTableId: newFieldTargetTableId }
      } else if ((newFieldType === 'lookup' || newFieldType === 'rollup') && newFieldRelationFieldId && newFieldTargetFieldId) {
        parsedOptions = {
          relationFieldId: newFieldRelationFieldId,
          targetFieldId: newFieldTargetFieldId,
          ...(newFieldType === 'rollup' && { rollupFunction: newFieldRollupFunction })
        }
      } else if (newFieldType === 'formula') {
        parsedOptions = newFieldOptions.trim()
      }

      await fieldService.createField(wsState.activeTableId, { name: newFieldName.trim(), type: newFieldType, options: parsedOptions })
      setShowNewFieldModal(false)
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldOptions('')
      await fetchTableData(wsState.activeTableId)
      await wsActions.fetchWorkspaces()
      uiActions.addToast(`欄位「${newFieldName}」已新增`, 'success')
    } catch {
      uiActions.addToast('新增欄位失敗', 'error')
    }
  }

  const deleteField = async (fieldId: number) => {
    if (!wsState.activeTableId) return
    try {
      await fieldService.deleteField(wsState.activeTableId, fieldId)
      await fetchTableData(wsState.activeTableId)
      await wsActions.fetchWorkspaces()
      uiActions.addToast('欄位已刪除', 'success')
    } catch {
      uiActions.addToast('刪除欄位失敗', 'error')
    }
  }

  const renameField = async (fieldId: number) => {
    if (!editingFieldName.trim() || !wsState.activeTableId) {
      setEditingFieldId(null)
      return
    }
    try {
      await fieldService.renameField(wsState.activeTableId, fieldId, editingFieldName.trim())
      setEditingFieldId(null)
      await fetchTableData(wsState.activeTableId)
      uiActions.addToast('欄位名稱已更新', 'success')
    } catch {
      uiActions.addToast('更新欄位名稱失敗', 'error')
    }
  }

  const handleUpdateField = async (fieldId: number, updates: Partial<TableField>) => {
    if (!wsState.activeTableId) return

    const formattedOptions = updates.options !== undefined
      ? (typeof updates.options === 'string' ? updates.options : JSON.stringify(updates.options))
      : undefined

    // Optimistically update local fields state immediately without re-fetching or showing loading spinner
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          ...updates,
          ...(formattedOptions !== undefined && { options: formattedOptions })
        }
      }
      return f
    }))

    const res = await fieldService.updateField(wsState.activeTableId, fieldId, updates)
    if (!res.ok) {
      uiActions.addToast(res.error || '更新欄位失敗', 'error')
    }
  }

  // View management using new services
  const saveViewConfig = async (updatedViewId: number, changes: ViewConfigPatch) => {
    if (!wsState.activeTableId) return
    try {
      const serializedChanges = {
        ...changes,
        ...(changes.filters !== undefined && {
          filters: typeof changes.filters === 'string' || changes.filters === null ? changes.filters : JSON.stringify(changes.filters)
        }),
        ...(changes.hiddenFields !== undefined && {
          hiddenFields: typeof changes.hiddenFields === 'string' || changes.hiddenFields === null ? changes.hiddenFields : JSON.stringify(changes.hiddenFields)
        }),
        ...(changes.columnWidths !== undefined && {
          columnWidths: typeof changes.columnWidths === 'string' || changes.columnWidths === null ? changes.columnWidths : JSON.stringify(changes.columnWidths)
        }),
        ...(changes.rowColors !== undefined && {
          rowColors: typeof changes.rowColors === 'string' || changes.rowColors === null ? changes.rowColors : JSON.stringify(changes.rowColors)
        }),
      }

      await viewService.updateViewConfig(wsState.activeTableId, updatedViewId, serializedChanges)
    } catch {}
  }

  const createView = async (name: string, type: ViewType) => {
    if (!name.trim() || !wsState.activeTableId) return
    try {
      const result = await viewService.createView(wsState.activeTableId, name.trim(), type)
      if (result.ok && result.view) {
        setViews(prev => [...prev, result.view!])
        wsActions.setActiveViewId(result.view!.id)
        applyViewConfig(result.view!)
        setShowNewViewModal(false)
        setNewViewName('')
        uiActions.addToast(`視圖「${result.view!.name}」已建立`, 'success')
      } else {
        uiActions.addToast(result.error || '建立視圖失敗', 'error')
      }
    } catch {
      uiActions.addToast('建立視圖失敗', 'error')
    }
  }

  const deleteView = async () => {
    if (!wsState.activeViewId || !wsState.activeTableId) return
    const activeView = views.find(v => v.id === wsState.activeViewId)
    if (!activeView) return

    if (!confirm(`確定要刪除視圖「${activeView.name}」？`)) return

    try {
      await viewService.deleteView(wsState.activeTableId, wsState.activeViewId)
      const remaining = views.filter(v => v.id !== wsState.activeViewId)
      setViews(remaining)
      if (remaining.length > 0) {
        wsActions.setActiveViewId(remaining[0].id)
        applyViewConfig(remaining[0])
      }
      uiActions.addToast('視圖已刪除', 'success')
    } catch {
      uiActions.addToast('刪除視圖失敗', 'error')
    }
  }

  const handleDuplicateView = async (targetViewId: number) => {
    const sourceView = views.find(v => v.id === targetViewId)
    if (!sourceView || !wsState.activeTableId) return
    const duplicateName = `${sourceView.name} (Copy)`
    try {
      const result = await viewService.createView(wsState.activeTableId, duplicateName, sourceView.type || 'grid')
      if (result.ok && result.view) {
        setViews(prev => [...prev, result.view!])
        wsActions.setActiveViewId(result.view!.id)
        applyViewConfig(result.view!)
        uiActions.addToast(`已成功複製視圖「${duplicateName}」`, 'success')
      } else {
        uiActions.addToast(result.error || '複製視圖失敗', 'error')
      }
    } catch {
      uiActions.addToast('複製視圖失敗', 'error')
    }
  }

  const handleDeleteViewById = async (targetViewId: number) => {
    if (!wsState.activeTableId) return
    const targetView = views.find(v => v.id === targetViewId)
    if (!targetView) return
    if (!confirm(`確定要刪除視圖「${targetView.name}」？`)) return
    try {
      await viewService.deleteView(wsState.activeTableId, targetViewId)
      const remaining = views.filter(v => v.id !== targetViewId)
      setViews(remaining)
      if (remaining.length > 0 && wsState.activeViewId === targetViewId) {
        wsActions.setActiveViewId(remaining[0].id)
        applyViewConfig(remaining[0])
      }
      uiActions.addToast('視圖已刪除', 'success')
    } catch {
      uiActions.addToast('刪除視圖失敗', 'error')
    }
  }

  const handleRenameViewById = async (targetViewId: number) => {
    const targetView = views.find(v => v.id === targetViewId)
    if (!targetView || !wsState.activeTableId) return
    const newName = prompt('請輸入新的視圖名稱：', targetView.name)
    if (newName && newName.trim() && newName.trim() !== targetView.name) {
      try {
        await viewService.updateViewConfig(wsState.activeTableId, targetViewId, { name: newName.trim() } as any)
        setViews(prev => prev.map(v => v.id === targetViewId ? { ...v, name: newName.trim() } : v))
        uiActions.addToast('視圖名稱已更新', 'success')
      } catch {
        uiActions.addToast('更新視圖名稱失敗', 'error')
      }
    }
  }

  // Rename handler using new service
  const handleRenameSubmit = async (newName?: string) => {
    const nameToUse = newName?.trim() || renameNameValue.trim()
    if (!nameToUse || !renameId || !renameType) return
    try {
      if (renameType === 'table') {
        const res = await fetch(`/api/tables/${renameId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nameToUse })
        })
        if (res.ok) uiActions.addToast('更新表名成功', 'success')
      } else {
        const result = await workspaceService.rename(renameType as 'workspace' | 'database', renameId, nameToUse)
        if (result.ok) uiActions.addToast('重新命名成功', 'success')
      }
      setShowRenameModal(false)
      await wsActions.fetchWorkspaces()
    } catch {
      uiActions.addToast('更新名稱失敗', 'error')
    }
  }

  // Get active table
  const activeTable = wsState.workspaces
    .flatMap(w => w.databases)
    .flatMap(d => d.tables)
    .find(t => t.id === wsState.activeTableId)

  // Show loading spinner while checking authentication
  if (authState.authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#f8fafc' }}>
        <div style={{ width: '32px', height: '32px', border: '4px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  // Show auth screen if not authenticated using new store
  if (!authState.currentUser) {
    return (
      <>
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, display: 'flex', flexDirection: 'column-reverse', gap: '10px', pointerEvents: 'none' }}>
          {uiState.toasts.map(toast => (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                padding: '12px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'success' ? '#16a34a' : '#2563eb',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.25)'
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
        <AuthScreen 
          authMode={authState.authMode}
          authUsername={authState.authUsername}
          authEmail={authState.authEmail}
          authPassword={authState.authPassword}
          errorMessage={authError}
          onAuthModeChange={(mode) => {
            setAuthError(null)
            authActions.setAuthMode(mode)
          }}
          onAuthUsernameChange={authActions.setAuthUsername}
          onAuthEmailChange={authActions.setAuthEmail}
          onAuthPasswordChange={authActions.setAuthPassword}
          onLogin={async (e) => {
            setAuthError(null)
            const result = await authActions.login(authState.authUsername, authState.authPassword)
            if (result.ok) {
              uiActions.addToast(`登入成功，歡迎回來！`, 'success')
            } else {
              setAuthError(result.error || '登入失敗，請檢查帳號或密碼')
              uiActions.addToast(result.error || '登入失敗，請檢查帳號或密碼', 'error')
            }
          }}
          onRegister={async (e) => {
            setAuthError(null)
            const result = await authActions.register(authState.authUsername, authState.authEmail, authState.authPassword)
            if (result.ok) {
              uiActions.addToast('註冊成功並已自動登入系統！', 'success')
              authActions.setAuthPassword('')
            } else {
              setAuthError(result.error || '註冊失敗')
              uiActions.addToast(result.error || '註冊失敗', 'error')
            }
          }}
        />
      </>
    )
  }

  const activeWorkspaceObj = wsState.workspaces.find(w => w.id === wsState.activeWorkspaceId)
  const activeMember = activeWorkspaceObj?.members?.find((m: any) => m.userId === authState.currentUser?.id)
  const currentUserRolePermissions = getRolePermissions(activeMember?.role || authState.currentUser?.role || 'admin')

  return (
    <div className={`app-container theme-${themeState.theme}`}>
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, display: 'flex', flexDirection: 'column-reverse', gap: '10px', pointerEvents: 'none' }}>
        {uiState.toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              padding: '12px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'success' ? '#16a34a' : '#2563eb',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Layout structure */}
      <div className="layout" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {/* Sidebar - using new modular component */}
        <Sidebar
        currentUser={authState.currentUser}
        userPermissions={currentUserRolePermissions}
        workspaces={wsState.workspaces}
        activeWorkspaceId={wsState.activeWorkspaceId}
        activeTableId={wsState.activeTableId}
        collapsedWorkspaces={wsState.collapsedWorkspaces}
        collapsedDatabases={wsState.collapsedDatabases}
        theme={themeState.theme}
        showDarkReaderPanel={themeState.showDarkReaderPanel}
        darkReaderSettings={themeState.darkReaderSettings}
        isSidebarCollapsed={isSidebarCollapsed}
        memberCount={workspaceMemberCount}
        notificationCount={unreadNotificationsCount}
        onShowMembersModal={() => setShowMembersModal(true)}
        onShowNotificationsModal={() => setShowNotificationsModal(true)}
        onShowUserSettingsModal={() => setShowUserSettingsModal(true)}
        onShowSubscriptionModal={() => setShowSubscriptionModal(true)}
        onToggleTheme={themeActions.toggleTheme}
        onToggleSidebarCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={authActions.logout}
        onToggleWorkspaceCollapse={wsActions.toggleWorkspaceCollapse}
        onToggleDatabaseCollapse={wsActions.toggleDatabaseCollapse}
        onSetActiveWorkspaceId={wsActions.setActiveWorkspaceId}
        onSetActiveTableId={wsActions.setActiveTableId}
        onShowWorkspaceModal={() => wsActions.setShowWorkspaceModal(true)}
        onShowDatabaseModal={(wsId: number) => {
          wsActions.setModalWsId(wsId)
          wsActions.setShowDatabaseModal(true)
        }}
        onShowCreateTableModal={(dbId: number) => {
          setModalDbIdForTable(dbId)
          setShowTableModal(true)
        }}
        onSetRenameType={setRenameType}
        onSetRenameId={setRenameId}
        onSetRenameNameValue={setRenameNameValue}
        onShowRenameModal={() => setShowRenameModal(true)}
        onDeleteWorkspaceOrDb={(action: 'delete_workspace' | 'delete_database', id: number, label: string) => {
          if (confirm(`確定要刪除「${label}」？`)) {
            wsActions.deleteWorkspaceOrDb(action, id)
          }
        }}
        onDeleteTable={async (tableId: number, tableName: string) => {
          if (confirm(`確定要刪除資料表「${tableName}」？`)) {
            try {
              const res = await fetch(`/api/tables/${tableId}`, { method: 'DELETE' })
              if (res.ok) {
                uiActions.addToast(`已成功刪除資料表「${tableName}」`, 'success')
                if (wsState.activeTableId === tableId) {
                  wsActions.setActiveTableId(0)
                }
                await wsActions.fetchWorkspaces()
              } else {
                uiActions.addToast('刪除資料表失敗', 'error')
              }
            } catch (err) {
              console.error('Failed to delete table', err)
              uiActions.addToast('刪除資料表失敗', 'error')
            }
          }
        }}
        onToggleDarkReaderPanel={() => themeActions.setShowDarkReaderPanel(true)}
        onUpdateDarkReaderSettings={(settings) => themeActions.updateDarkReaderSettings(settings)}
      />

      {/* Main Content */}
      <div className="layout__col-2" style={{ left: isSidebarCollapsed ? '0px' : '240px', transition: 'left 0.2s ease' }}>
        {!wsState.activeTableId ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
            <h2>請選擇一個資料表</h2>
            <p>從左側邊欄選擇工作區、資料庫和資料表開始使用</p>
          </div>
        ) : (
          <>
            {/* View selector and header toolbar */}
            <ViewToolbar
              canManageStructure={currentUserRolePermissions.canManageStructure}
              isSidebarCollapsed={isSidebarCollapsed}
              setIsSidebarCollapsed={setIsSidebarCollapsed}
              views={views}
              activeViewId={wsState.activeViewId}
              setActiveViewId={wsActions.setActiveViewId}
              applyViewConfig={applyViewConfig}
              setShowNewViewModal={setShowNewViewModal}
              saveViewConfig={saveViewConfig}
              onDuplicateView={handleDuplicateView}
              onDeleteView={handleDeleteViewById}
              onRenameView={handleRenameViewById}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortField={sortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              filterRules={filterRules}
              setFilterRules={(rules) => {
                setFilterRules(rules)
                if (wsState.activeViewId) {
                  saveViewConfig(wsState.activeViewId, { filters: JSON.stringify(rules) })
                }
              }}
              rowColorRules={rowColorRules}
              setRowColorRules={(rules) => {
                setRowColorRules(rules)
                if (wsState.activeViewId) {
                  saveViewConfig(wsState.activeViewId, { rowColors: JSON.stringify(rules) })
                }
              }}
              groupByField={groupByField}
              setGroupByField={setGroupByField}
              fields={fields}
              hiddenFieldKeys={hiddenFieldKeys}
              setHiddenFieldKeys={setHiddenFieldKeys}
              rowHeightSize={rowHeightSize}
              setRowHeightSize={setRowHeightSize}
              handleExportCSV={handleExportCSV}
              handleCSVImport={handleCSVImport}
              csvInputRef={csvInputRef}
            />

            {/* View content */}
            <div
              className="layout__col-2-2 content"
              style={{
                '--row-height': rowHeightSize === 'medium' ? '44px' : rowHeightSize === 'large' ? '60px' : rowHeightSize === 'extra' ? '80px' : '32px'
              } as any}
            >
              <DatabaseViewRouter
                currentView={currentView}
                fields={fields}
                hiddenFieldKeys={hiddenFieldKeys}
                displayRows={displayRows}
                gridLoading={gridLoading}
                readOnly={!currentUserRolePermissions.canEditData}
                frozenColumnsCount={frozenColumnsCount}
                columnWidths={columnWidths}
                sortField={sortField}
                sortOrder={sortOrder}
                groupByField={groupByField}
                rowColorRules={rowColorRules}
                editingFieldId={editingFieldId}
                editingFieldName={editingFieldName}
                editingCell={editingCell}
                editInputRef={editInputRef}
                searchQuery={searchQuery}
                filterRules={filterRules}
                groupedRows={groupedRows}
                getRowBgColorClass={getRowBgColorClass}
                updateCell={updateCell}
                toggleSort={toggleSort}
                setEditingFieldId={setEditingFieldId}
                setEditingFieldName={setEditingFieldName}
                handleColumnDragStart={handleColumnDragStart}
                handleColumnDragOver={handleColumnDragOver}
                handleColumnDrop={handleColumnDrop}
                setColumnWidths={setColumnWidths}
                activeTableId={wsState.activeTableId}
                activeViewId={wsState.activeViewId}
                updateViewConfig={viewService.updateViewConfig}
                setContextMenu={setContextMenu}
                setSelectedRow={setSelectedRow}
                setShowDetailModal={setShowDetailModal}
                duplicateRow={duplicateRow}
                deleteRow={deleteRow}
                addRow={addRow}
                setShowNewFieldModal={setShowNewFieldModal}
                handleUpdateField={handleUpdateField}
                setFieldContextMenu={setFieldContextMenu}
                onUndo={undo}
                onRedo={redo}
                onReorderRows={handleReorderRows}
              />
            </div>
          </>
        )}
      </div>
    </div>

      {/* Global Modals Container - Always Mounted */}
      <GlobalModalsContainer
        wsState={wsState}
        wsActions={wsActions}
        uiActions={uiActions}
        showTableModal={showTableModal}
        setShowTableModal={setShowTableModal}
        modalDbIdForTable={modalDbIdForTable}
        showRenameModal={showRenameModal}
        setShowRenameModal={setShowRenameModal}
        handleRenameSubmit={handleRenameSubmit}
        renameNameValue={renameNameValue}
        renameType={renameType}
        showNewViewModal={showNewViewModal}
        setShowNewViewModal={setShowNewViewModal}
        createView={createView}
        showNewFieldModal={showNewFieldModal}
        setShowNewFieldModal={setShowNewFieldModal}
        editingFieldForModal={editingFieldForModal}
        setEditingFieldForModal={setEditingFieldForModal}
        handleUpdateField={handleUpdateField}
        setFields={setFields}
        fields={fields}
        showDetailModal={showDetailModal}
        setShowDetailModal={setShowDetailModal}
        selectedRow={selectedRow}
        setSelectedRow={setSelectedRow}
        displayRows={displayRows}
        currentUserRolePermissions={currentUserRolePermissions}
        updateCell={updateCell}
        showMembersModal={showMembersModal}
        setShowMembersModal={setShowMembersModal}
        activeTable={activeTable}
        setWorkspaceMemberCount={setWorkspaceMemberCount}
        showNotificationsModal={showNotificationsModal}
        setShowNotificationsModal={setShowNotificationsModal}
        fieldContextMenu={fieldContextMenu}
        setFieldContextMenu={setFieldContextMenu}
        filterRules={filterRules}
        setFilterRules={setFilterRules}
        hiddenFieldKeys={hiddenFieldKeys}
        setHiddenFieldKeys={setHiddenFieldKeys}
        saveViewConfig={saveViewConfig}
        toggleSort={toggleSort}
        setGroupByField={setGroupByField}
        deleteField={deleteField}
      />

      {/* User Account & Subscription Modals - Always Mounted */}
      {authState.currentUser && (
        <UserSettingsModal
          show={showUserSettingsModal}
          onClose={() => setShowUserSettingsModal(false)}
          currentUser={authState.currentUser}
          onToast={uiActions.addToast}
        />
      )}

      <SubscriptionModal
        show={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        workspace={wsState.workspaces.find(w => w.id === wsState.activeWorkspaceId) || wsState.workspaces[0] || null}
        onToast={uiActions.addToast}
      />

      <DarkReaderModal
        show={themeState.showDarkReaderPanel}
        onClose={() => themeActions.setShowDarkReaderPanel(false)}
        theme={themeState.theme}
        onToggleTheme={themeActions.toggleTheme}
        darkReaderSettings={themeState.darkReaderSettings}
        onUpdateDarkReaderSettings={themeActions.updateDarkReaderSettings}
        onToast={uiActions.addToast}
      />
    </div>
  )
}
