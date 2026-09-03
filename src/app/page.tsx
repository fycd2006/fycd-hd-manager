'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import DatabaseViewRouter from '@/modules/database/components/views/DatabaseViewRouter'
import TableWorkspaceView from '@/modules/database/components/views/TableWorkspaceView'
import GlobalModalsContainer from '@/modules/database/components/modals/GlobalModalsContainer'
import useTableCSV from '@/modules/database/hooks/useTableCSV'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { PanelLeft, PanelLeftClose, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, AlignJustify, Search } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ViewToolbar } from '@/modules/database/components/toolbar/ViewToolbar'
import { useUndoRedo } from '@/hooks/useUndoRedo'
import { AuthScreen } from '@/modules/database/components/auth'
import Sidebar from '@/modules/database/components/sidebar/Sidebar'
import { WorkspaceModal, DatabaseModal, RenameModal, ViewModal, FieldModal, TableModal } from '@/modules/database/components/modals/Modals'

const AirtableImportModal = dynamic(() => import('@/modules/database/components/import/AirtableImportModal').then(m => m.AirtableImportModal), { ssr: false })
const MembersModal = dynamic(() => import('@/modules/database/components/modals/MembersModal'), { ssr: false })
const NotificationsModal = dynamic(() => import('@/modules/database/components/modals/NotificationsModal'), { ssr: false })
const UserSettingsModal = dynamic(() => import('@/modules/database/components/modals/UserSettingsModal'), { ssr: false })
const SubscriptionModal = dynamic(() => import('@/modules/database/components/modals/SubscriptionModal'), { ssr: false })
const DarkReaderModal = dynamic(() => import('@/modules/database/components/modals/DarkReaderModal'), { ssr: false })
import { getRolePermissions } from '@/lib/permissions'
import { getSessionUser } from '@/lib/auth'
import { useTableOperations } from '@/modules/database/hooks/useTableOperations'
import GridView from '@/modules/database/components/table/GridView'
import { FieldContextMenu } from '@/modules/database/components/menu/FieldContextMenu'
import { parseSelectItems, evaluateCellCondition, parseNumberInput } from '@/modules/database/components/views/grid/cells/utils'
import { normalizeRowData } from '@/modules/database/utils/normalizeRowData'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { useI18n } from '@/lib/i18n/i18nContext'
import { FIELD_TYPE_ICONS, FIELD_TYPE_LABELS, Icons } from '@/modules/database/constants'
import { useViewConfig } from '@/modules/database/hooks/useViewConfig'
import { useRealtimeSync } from '@/modules/database/hooks/useRealtimeSync'
import { useFieldOperations } from '@/modules/database/hooks/useFieldOperations'
import { useMoveOperations } from '@/modules/database/hooks/useMoveOperations'
import { useCellEdit } from '@/modules/database/hooks/useCellEdit'
import { useRowOperations } from '@/modules/database/hooks/useRowOperations'
import { TableProvider, TableContextValue } from '@/modules/database/context/TableContext'
const getViewIcon = (type: string, props: any) => {
  switch (type) {
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
import WorkspaceDashboard from '@/modules/database/components/dashboard/WorkspaceDashboard'
import MobileBottomNav from '@/modules/database/components/navigation/MobileBottomNav'
import PullToRefresh from '@/components/ui/PullToRefresh'
import { FYCDBrandLoading } from '@/components/fycd/FYCDBrandLoading'
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
import { createDatabaseFromTemplate, TemplateKey } from '@/modules/database/services/templateService'
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
  RowColorRule,
  GroupCollapseState,
  GroupByRule,
  SortRule
} from '@/modules/database/types'

export default function Home() {
  const { t } = useI18n()
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
  // Real-time updates indicator
  const [isSyncing, setIsSyncing] = useState(false)

  // Use the new operations hook
  const { rows, operations, mergeServerRows, dispatch } = useTableOperations(wsState.activeTableId)

  const setRows = useCallback((payload: TableRow[] | ((prev: TableRow[]) => TableRow[])) => {
    dispatch({ type: 'SET_BASE_ROWS', payload })
  }, [dispatch])
  const [gridLoading, setGridLoading] = useState(false)
  const [showBrandLoading, setShowBrandLoading] = useState<boolean>(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [editingCell, setEditingCell] = useState<{ rowId: number; fieldKey: string } | null>(null)
  const [editingCellValue, setEditingCellValue] = useState('')
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null)
  const [editingFieldName, setEditingFieldName] = useState('')
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0)

  // View configuration and rules hook
  const {
    views, setViews,
    currentView, setCurrentView,
    showNewViewModal, setShowNewViewModal,
    newViewName, setNewViewName,
    newViewType, setNewViewType,
    sortField, setSortField,
    sortOrder, setSortOrder,
    sortRules, setSortRules,
    searchQuery, setSearchQuery,
    showFilterPanel, setShowFilterPanel,
    filterRules, setFilterRules,
    filterType, setFilterType,
    hiddenFieldKeys, setHiddenFieldKeys,
    columnWidths, setColumnWidths,
    showHiddenFieldsPanel, setShowHiddenFieldsPanel,
    rowColorRules, setRowColorRules,
    showRowColorsPanel, setShowRowColorsPanel,
    showGroupByPanel, setShowGroupByPanel,
    groupByField, setGroupByField,
    groupByRules, setGroupByRules,
    applyViewConfig,
    saveViewConfig,
    toggleSort,
    toggleFieldVisibility,
    createView,
    deleteView,
    handleDuplicateView,
    handleDeleteViewById,
    handleRenameViewById,
    resetViewState,
  } = useViewConfig({
    activeTableId: wsState.activeTableId,
    activeViewId: wsState.activeViewId,
    setActiveViewId: wsActions.setActiveViewId,
    addToast: uiActions.addToast,
  })

  // Expand detail view modal
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null)

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [fieldContextMenu, setFieldContextMenu] = useState<{ field: TableField; x: number; y: number } | null>(null)

  const [authError, setAuthError] = useState<string | null>(null)
  const [draggedFieldId, setDraggedFieldId] = useState<number | null>(null)

  // Other UI & Modal state
  const [frozenColumnsCount, setFrozenColumnsCount] = useState<number>(1)
  const [autoInherit, setAutoInherit] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showNotificationsModal, setShowNotificationsModal] = useState(false)
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [workspaceMemberCount, setWorkspaceMemberCount] = useState<number>(1)
  const [systemUsers, setSystemUsers] = useState<User[]>([])

  // Edit Input Ref
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleExitComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fycd_intro_seen_desktop', 'true')
    }
    setShowBrandLoading(false)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768
      const hasSeenIntro = localStorage.getItem('fycd_intro_seen_desktop')
      if (isMobile || !hasSeenIntro) {
        setShowBrandLoading(true)
      } else {
        setShowBrandLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (authState.currentUser) {
      wsActions.fetchWorkspaces().then(() => {
        setWorkspaceReady(true)
      })
      fetch('/api/notifications')
        .then(res => res.ok ? res.json() : { notifications: [] })
        .then(data => {
          const unread = (data.notifications || []).filter((n: any) => !n.read).length
          setUnreadNotificationsCount(unread)
        })
        .catch(() => { })
    } else {
      setWorkspaceReady(true)
    }
  }, [authState.currentUser])

  // Rename modal states
  const [renameType, setRenameType] = useState<'workspace' | 'database' | 'table' | null>(null)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameNameValue, setRenameNameValue] = useState('')
  const [rowHeightSize, setRowHeightSize] = useState<'small' | 'medium' | 'large' | 'extra'>('small')
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [showTableModal, setShowTableModal] = useState(false)
  const [modalDbIdForTable, setModalDbIdForTable] = useState<number | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [showAirtableModal, setShowAirtableModal] = useState(false)
  const [groupCollapseState, setGroupCollapseState] = useState<GroupCollapseState>({
    mode: 'expand',
    exceptions: {},
  })

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

  // Initialize authentication and resetToken query handling on page mount
  useEffect(() => {
    authActions.checkAuth()

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get('resetToken')
      if (token) {
        authActions.setResetToken(token)
        authActions.setAuthMode('reset-password')
      }
    }
  }, [])



  // Undo / Redo Hook
  const updateCellRef = useRef<(rowId: number, fieldKey: string, value: CellValue, skipPushHistory?: boolean) => Promise<void>>(async () => { })
  const [isOffline, setIsOffline] = useState<boolean>(false)
  const batchUpdateCellsRef = useRef<(updates: Array<{ rowId: number; data: Record<string, CellValue> }>) => Promise<void>>(async () => { })

  const { pushEdit, undo, redo, canUndo, canRedo } = useUndoRedo(
    async (tableId, rowId, fieldKey, val) => {
      await updateCellRef.current(rowId, fieldKey, val, true)
    },
    async (tableId, updates) => {
      await batchUpdateCellsRef.current(updates)
    }
  )

  // Global Ctrl+Z (Undo) / Ctrl+Y / Ctrl+Shift+Z (Redo) Keydown Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const target = e.target as HTMLElement | null
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      )

      // If keydown originated inside .grid-view, let GridView handle it to avoid duplicate undo/redo execution
      if ((target && typeof target.closest === 'function' && target.closest('.grid-view')) ||
          (activeEl && typeof activeEl.closest === 'function' && activeEl.closest('.grid-view'))) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && !isInputFocused) {
        if (e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault()
            redo(wsState.activeTableId)
          } else {
            e.preventDefault()
            undo(wsState.activeTableId)
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault()
          redo(wsState.activeTableId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, wsState.activeTableId])

  const tableFetchRequestId = useRef<number>(0)

  // Fetch table data using parallel services with race-condition protection & atomic state hydration
  const fetchTableData = useCallback(async (tableId: number) => {
    const currentRequestId = ++tableFetchRequestId.current
    setGridLoading(true)
    try {
      const [fieldsData, rowsData, viewsData] = await Promise.all([
        fieldService.fetchFields(tableId),
        rowService.fetchRows(tableId),
        viewService.fetchViews(tableId),
      ])

      // Drop stale response if user switched to another table before this finished
      if (currentRequestId !== tableFetchRequestId.current) return

      setFields(fieldsData)
      mergeServerRows(rowsData)

      if (Array.isArray(viewsData) && viewsData.length > 0) {
        setViews(viewsData)
        const savedViewIdStr = typeof window !== 'undefined' ? localStorage.getItem(`activeViewId_${tableId}`) : null
        const savedViewId = savedViewIdStr ? parseInt(savedViewIdStr, 10) : null
        const targetView = (savedViewId && viewsData.find(v => v.id === savedViewId)) || viewsData[0]
        wsActions.setActiveViewId(targetView.id)
        applyViewConfig(targetView)
      } else {
        resetViewState()
      }
    } catch (error) {
      if (currentRequestId !== tableFetchRequestId.current) return
      console.error('Failed to load table data:', error)
      uiActions.addToast(t('toasts.loadTableFailed'), 'error')
    } finally {
      if (currentRequestId === tableFetchRequestId.current) {
        setGridLoading(false)
      }
    }
  }, [uiActions, mergeServerRows, t, wsActions, applyViewConfig, resetViewState, setViews])

  // New Field scroll trigger
  const [newFieldScrollTrigger, setNewFieldScrollTrigger] = useState(0)
  const handleFieldCreated = useCallback(() => {
    setNewFieldScrollTrigger(c => c + 1)
  }, [])

  // Field CRUD and modals hook
  const {
    showNewFieldModal, setShowNewFieldModal,
    newFieldPopoverPos, setNewFieldPopoverPos,
    newFieldName, setNewFieldName,
    newFieldType, setNewFieldType,
    newFieldOptions, setNewFieldOptions,
    newFieldTargetTableId, setNewFieldTargetTableId,
    newFieldRelationFieldId, setNewFieldRelationFieldId,
    newFieldTargetFieldId, setNewFieldTargetFieldId,
    newFieldRollupFunction, setNewFieldRollupFunction,
    targetTableFields, setTargetTableFields,
    editingFieldForModal, setEditingFieldForModal,
    createField,
    deleteField,
    renameField,
    handleUpdateField,
  } = useFieldOperations({
    activeTableId: wsState.activeTableId,
    setFields,
    fetchTableData,
    fetchWorkspaces: wsActions.fetchWorkspaces,
    addToast: uiActions.addToast,
    onFieldCreated: handleFieldCreated,
  })

  // Cross-table cut and paste operations hook
  const { stageMoveRows, cancelMoveRows, batchMoveRows } = useMoveOperations({
    activeTableId: wsState.activeTableId,
    rows,
    operations,
    dispatch,
    fetchTableData,
    addToast: uiActions.addToast,
  })

  // Real-time multi-user WebSocket synchronization via Pusher
  useRealtimeSync({
    activeTableId: wsState.activeTableId,
    setRows,
    setFields,
    fetchTableData,
    addToast: uiActions.addToast,
  })

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

  // Load table data and reset transient UI state when activeTableId changes
  useEffect(() => {
    // Reset all transient UI states on table switch
    setEditingCell(null)
    setSelectedRow(null)
    setShowDetailModal(false)
    setContextMenu(null)
    setFieldContextMenu(null)
    setSearchQuery('')

    if (wsState.activeTableId) {
      setGridLoading(true)
      setFields([])
      setRows([])
      fetchTableData(wsState.activeTableId)
    } else {
      setFields([])
      setRows([])
      setGridLoading(false)
    }
  }, [wsState.activeTableId, fetchTableData, setSearchQuery, setRows, setFields])

  // Cell and batch editing hook
  const { updateCell, batchUpdateCells } = useCellEdit({
    activeTableId: wsState.activeTableId,
    rows,
    setRows,
    fields,
    pushEdit,
    addToast: uiActions.addToast,
  })

  updateCellRef.current = updateCell
  batchUpdateCellsRef.current = batchUpdateCells

  // Expose helpers for E2E automated resilience testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).updateCell = updateCell
      ;(window as any).fetchTableData = fetchTableData
      ;(window as any).dispatchTableOp = dispatch
      ;(window as any).rows = rows
      ;(window as any).fields = fields
      ;(window as any).__activeTableId = wsState.activeTableId
    }
  }, [updateCell, fetchTableData, dispatch, rows, fields, wsState.activeTableId])






  // Helper to extract cell value regardless of key format (field_1 vs 1 vs "1")
  const getCellValue = (row: TableRow, fieldKeyOrId: string) => {
    if (!row || !row.data) return ''
    const cleanId = String(fieldKeyOrId).replace('field_', '')
    const fk = `field_${cleanId}`
    if (fk in row.data) return row.data[fk] ?? ''
    if (cleanId in row.data) return row.data[cleanId] ?? ''
    if (Number(cleanId) in row.data) return row.data[Number(cleanId)] ?? ''
    return ''
  }

  const frozenDisplayRowsRef = useRef<TableRow[] | null>(null)

  useEffect(() => {
    if (!editingCell) {
      frozenDisplayRowsRef.current = null
    }
  }, [editingCell])

  // Get display rows with filters and sorting (memoized)
  const displayRows = useMemo(() => {
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
        if (filterType === 'OR') {
          return filterRules.some(rule => {
            const val = getCellValue(row, rule.fieldKey)
            const field = fields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey || f.name === rule.fieldKey)
            return evaluateCellCondition(val, field, rule.operator, rule.value)
          })
        }
        return filterRules.every(rule => {
          const val = getCellValue(row, rule.fieldKey)
          const field = fields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey || f.name === rule.fieldKey)
          return evaluateCellCondition(val, field, rule.operator, rule.value)
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

    // Multi-level Sort when not editing
    const effectiveSorts = sortRules && sortRules.length > 0
      ? sortRules
      : (sortField ? [{ fieldKey: sortField, order: sortOrder || 'asc' }] : [])

    if (effectiveSorts.length > 0) {
      result.sort((a, b) => {
        for (const rule of effectiveSorts) {
          const ruleField = rule.fieldKey
          const ruleOrder = rule.order
          const fieldObj = fields.find(f => `field_${f.id}` === ruleField || String(f.id) === ruleField || f.name === ruleField)
          const rawA = getCellValue(a, ruleField)
          const rawB = getCellValue(b, ruleField)

          const isAEmpty = rawA === null || rawA === undefined || rawA === ''
          const isBEmpty = rawB === null || rawB === undefined || rawB === ''

          if (isAEmpty && isBEmpty) continue
          if (isAEmpty) return 1
          if (isBEmpty) return -1

          let diff = 0
          if (fieldObj?.type === 'single_select' || fieldObj?.type === 'multiple_select') {
            const namesA = parseSelectItems(rawA, fieldObj.options).join(', ')
            const namesB = parseSelectItems(rawB, fieldObj.options).join(', ')
            diff = namesA.localeCompare(namesB, 'zh-TW', { numeric: true })
          } else {
            const numA = parseNumberInput(rawA)
            const numB = parseNumberInput(rawB)
            if (numA !== null && numB !== null) {
              diff = numA - numB
            } else {
              diff = String(rawA || '').localeCompare(String(rawB || ''), 'zh-TW', { numeric: true })
            }
          }

          if (diff !== 0) {
            return ruleOrder === 'asc' ? diff : -diff
          }
        }
        return 0
      })
    }

    frozenDisplayRowsRef.current = result
    return result
  }, [rows, searchQuery, filterRules, filterType, sortRules, sortField, sortOrder, editingCell, fields, groupByRules, groupByField])

  // Get row background color
  const getRowBgColorClass = useCallback((row: TableRow) => {
    if (rowColorRules.length === 0) return ''
    const matched = rowColorRules.find(rule => {
      const field = fields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey || f.name === rule.fieldKey)
      const val = row.data[rule.fieldKey]
      return evaluateCellCondition(val, field, rule.operator, rule.value)
    })
    return matched ? `row-color-${matched.color}` : ''
  }, [rowColorRules, fields])

  // Get grouped rows (memoized)
  const groupedRows = useMemo(() => {
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
  }, [groupByField, displayRows])

  // Row CRUD & Drag-and-drop operations hook
  const {
    addRow,
    batchAddRows,
    handleReorderRows,
    deleteRow,
    duplicateRow,
  } = useRowOperations({
    activeTableId: wsState.activeTableId,
    activeViewId: wsState.activeViewId,
    fields,
    rows,
    setRows,
    displayRows,
    groupByRules,
    groupByField,
    sortField,
    sortRules,
    setSortField,
    setSortRules,
    setSortOrder,
    saveViewConfig,
    addToast: uiActions.addToast,
    setEditingCell,
    setEditingCellValue,
  })

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
        if (res.ok) {
          uiActions.addToast('更新表名成功', 'success')
        } else {
          const errData = await res.json().catch(() => ({}))
          uiActions.addToast(errData.error || '更新表名失敗', 'error')
        }
      } else {
        const result = await workspaceService.rename(renameType as 'workspace' | 'database', renameId, nameToUse)
        if (result.ok) {
          uiActions.addToast('重新命名成功', 'success')
        } else {
          uiActions.addToast(result.error || '更新名稱失敗', 'error')
        }
      }
      setShowRenameModal(false)
      setRenameType(null)
      setRenameId(null)
      setRenameNameValue('')
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

  const activeWorkspaceObj = wsState.workspaces.find(w => w.id === wsState.activeWorkspaceId)
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const activeMember = activeWorkspaceObj?.members?.find((m: any) => m.userId === authState.currentUser?.id)
  const currentUserRolePermissions = getRolePermissions(activeMember?.role || authState.currentUser?.role || 'admin')

  const tableContextValue = useMemo<TableContextValue>(() => ({
    activeTableId: wsState.activeTableId,
    activeTable: activeTable ?? null,
    fields,
    setFields,
    rows,
    setRows,
    displayRows,
    groupedRows,
    gridLoading: false,
    readOnly: !authState.currentUser || !currentUserRolePermissions.canEditData,

    views,
    activeViewId: wsState.activeViewId,
    currentView,
    filterRules,
    sortRules,
    hiddenFieldKeys,
    rowColorRules,
    groupByRules,
    columnWidths,
    saveViewConfig,
    toggleSort,
    setColumnWidths,
    setFilterRules,
    setHiddenFieldKeys,
    setRowColorRules,
    setGroupByRules,
    createView,

    updateCell,
    batchUpdateCells,
    addRow,
    batchAddRows,
    deleteRow,
    duplicateRow,
    fetchTableData,

    createField,
    deleteField,
    handleUpdateField,

    stageMoveRows,
    cancelMoveRows,
    batchMoveRows,

    selectedRow,
    setSelectedRow,
    showDetailModal,
    setShowDetailModal,
    showNewFieldModal,
    setShowNewFieldModal,
    fieldContextMenu,
    setFieldContextMenu,
  }), [
    wsState.activeTableId,
    activeTable,
    fields,
    setFields,
    rows,
    setRows,
    displayRows,
    groupedRows,
    authState.currentUser,
    currentUserRolePermissions.canEditData,
    views,
    wsState.activeViewId,
    currentView,
    filterRules,
    sortRules,
    hiddenFieldKeys,
    rowColorRules,
    groupByRules,
    columnWidths,
    saveViewConfig,
    toggleSort,
    setColumnWidths,
    setFilterRules,
    setHiddenFieldKeys,
    setRowColorRules,
    setGroupByRules,
    createView,
    updateCell,
    batchUpdateCells,
    addRow,
    batchAddRows,
    deleteRow,
    duplicateRow,
    fetchTableData,
    createField,
    deleteField,
    handleUpdateField,
    stageMoveRows,
    cancelMoveRows,
    batchMoveRows,
    selectedRow,
    setSelectedRow,
    showDetailModal,
    setShowDetailModal,
    showNewFieldModal,
    setShowNewFieldModal,
    fieldContextMenu,
    setFieldContextMenu,
  ])

  // Show unified App Shell skeleton during initial load & authentication check
  if (authState.authLoading) {
    const isDark = themeState.theme === 'dark'
    return (
      <div className={`app-container theme-${themeState.theme}`} suppressHydrationWarning style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: isDark ? '#0f172a' : '#fafafa' }}>
        {/* Top Brand Accent Line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          zIndex: 50,
          background: 'linear-gradient(90deg, #52A628 0%, #EA580C 50%, #52A628 100%)',
          backgroundSize: '200% 100%',
          animation: 'fycdTopBarShimmer 2s ease-in-out infinite'
        }} />

        {/* Sidebar Skeleton */}
        <div style={{ width: '240px', height: '100%', borderRight: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: isDark ? '#1e293b' : '#ffffff', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.png"
              alt="FYCD HD Logo"
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #EA580C', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.2)' }}
            />
            <div style={{ width: '110px', height: '16px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {[85, 65, 75, 55, 80].map((w, i) => (
              <div key={i} style={{ width: `${w}%`, height: '16px', borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#f1f5f9', opacity: 0.8 }} />
            ))}
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* View Toolbar Skeleton */}
          <div style={{ height: '44px', borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '14px', backgroundColor: isDark ? '#1e293b' : '#ffffff' }}>
            <div style={{ width: '110px', height: '22px', borderRadius: '6px', backgroundColor: isDark ? '#334155' : '#e2e8f0' }} />
            <div style={{ width: '75px', height: '22px', borderRadius: '6px', backgroundColor: isDark ? '#334155' : '#f1f5f9' }} />
            <div style={{ width: '75px', height: '22px', borderRadius: '6px', backgroundColor: isDark ? '#334155' : '#f1f5f9' }} />
          </div>

          {/* Grid Skeleton */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: isDark ? '#0f172a' : '#ffffff' }}>
            <div style={{ display: 'flex', gap: '8px', height: '32px' }}>
              {[1, 2, 3, 4, 5].map(col => (
                <div key={col} style={{ flex: 1, borderRadius: '4px', backgroundColor: isDark ? '#334155' : '#cbd5e1', opacity: 0.7 }} />
              ))}
            </div>
            {[1, 2, 3, 4, 5, 6, 7].map(row => (
              <div key={row} style={{ display: 'flex', gap: '8px', height: '34px' }}>
                {[1, 2, 3, 4, 5].map(col => (
                  <div key={col} style={{ flex: 1, borderRadius: '4px', backgroundColor: isDark ? '#1e293b' : '#f8fafc' }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <style jsx>{`
          @keyframes fycdTopBarShimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}</style>
      </div>
    )
  }

  // Show clean brand loading during initial authLoading to prevent FOAC
  if (authState.authLoading) {
    return (
      <div className={`app-container theme-${themeState.theme}`} style={{ width: '100vw', height: '100vh', background: themeState.theme === 'dark' ? '#18191b' : '#f4f5f7' }}>
        <FYCDBrandLoading
          show={showBrandLoading}
          workspaceReady={workspaceReady}
          onExitComplete={handleExitComplete}
        />
      </div>
    )
  }

  // Show auth screen if not authenticated using new store
  if (!authState.currentUser) {
    return (
      <>
        <FYCDBrandLoading
          show={showBrandLoading}
          workspaceReady={workspaceReady}
          onExitComplete={handleExitComplete}
        />
        {!showBrandLoading && (
          <>
            <ToastContainer toasts={uiState.toasts} />
            <AuthScreen
              authMode={authState.authMode}
              authUsername={authState.authUsername}
              authEmail={authState.authEmail}
              authPassword={authState.authPassword}
              resetToken={authState.resetToken}
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
                setShowBrandLoading(true)
                setWorkspaceReady(false)
                const result = await authActions.login(authState.authUsername, authState.authPassword)
                if (result.ok) {
                  uiActions.addToast(`登入成功，歡迎回來！`, 'success')
                } else {
                  setShowBrandLoading(false)
                  setAuthError(result.error || '登入失敗，請檢查帳號或密碼')
                  uiActions.addToast(result.error || '登入失敗，請檢查帳號或密碼', 'error')
                }
              }}
              onRegister={async (e) => {
                setAuthError(null)
                setShowBrandLoading(true)
                setWorkspaceReady(false)
                const result = await authActions.register(authState.authUsername, authState.authEmail, authState.authPassword)
                if (result.ok) {
                  uiActions.addToast('註冊成功並已自動登入系統！', 'success')
                  authActions.setAuthPassword('')
                } else {
                  setShowBrandLoading(false)
                  setAuthError(result.error || '註冊失敗')
                  uiActions.addToast(result.error || '註冊失敗', 'error')
                }
              }}
              onRequestResetPassword={async (username, email) => {
                setAuthError(null)
                const result = await authActions.requestPasswordReset(username, email)
                if (result.ok) {
                  uiActions.addToast(result.message || '身分核對成功，請設定新密碼', 'success')
                } else {
                  setAuthError(result.error || '身分核對失敗')
                  uiActions.addToast(result.error || '身分核對失敗', 'error')
                }
                return result
              }}
              onResetPassword={async (newPassword) => {
                setAuthError(null)
                const result = await authActions.resetPassword(authState.resetToken, newPassword)
                if (result.ok) {
                  uiActions.addToast('密碼已成功重設，請使用新密碼登入', 'success')
                  authActions.setAuthPassword('')
                  authActions.setResetToken('')
                  authActions.setAuthMode('login')
                  if (typeof window !== 'undefined' && window.history?.replaceState) {
                    const cleanUrl = window.location.pathname
                    window.history.replaceState({}, document.title, cleanUrl)
                  }
                } else {
                  setAuthError(result.error || '重設密碼失敗')
                  uiActions.addToast(result.error || '重設密碼失敗', 'error')
                }
                return result
              }}
            />

          </>
        )}
      </>
    )
  }

  const handleCreateDatabaseFromTemplate = async (templateKey: TemplateKey) => {
    if (!activeWorkspaceObj) return
    const result = await createDatabaseFromTemplate(activeWorkspaceObj.id, templateKey)
    if (result.ok) {
      uiActions.addToast(`已成功從範本建立資料庫！`, 'success')
      await wsActions.fetchWorkspaces()
      if (result.newTableId) {
        wsActions.setActiveTableId(result.newTableId)
      }
    } else {
      uiActions.addToast(result.error || '從範本建立失敗', 'error')
    }
  }

  return (
    <TableProvider value={tableContextValue}>
      <div className={`app-container theme-${themeState.theme}`} suppressHydrationWarning>
        <FYCDBrandLoading
          show={showBrandLoading}
          workspaceReady={workspaceReady}
          onExitComplete={handleExitComplete}
        />
      <ToastContainer toasts={uiState.toasts} />

      <div className="layout" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
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
          onSelectDashboard={() => wsActions.setActiveTableId(0)}
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
          onMoveTableToDatabase={wsActions.moveTableToDatabase}
          onReorderDatabases={wsActions.reorderDatabases}
        />

        <div className="layout__col-2" style={{ left: isSidebarCollapsed ? '56px' : '250px', transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {!wsState.activeTableId || wsState.activeTableId === 0 ? (
            <div key="workspace_dashboard" className="animate-view-transition" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <WorkspaceDashboard
                currentUser={authState.currentUser}
                activeWorkspace={activeWorkspaceObj || null}
                workspaces={wsState.workspaces}
                onSelectTable={(tableId) => wsActions.setActiveTableId(tableId)}
                onShowMembersModal={() => setShowMembersModal(true)}
                onShowDatabaseModal={(wsId) => {
                  wsActions.setModalWsId(wsId)
                  wsActions.setShowDatabaseModal(true)
                }}
                onShowCreateTableModal={(dbId) => {
                  setModalDbIdForTable(dbId)
                  setShowTableModal(true)
                }}
                onSetRenameType={setRenameType}
                onSetRenameId={setRenameId}
                onSetRenameNameValue={setRenameNameValue}
                onShowRenameModal={() => setShowRenameModal(true)}
                onDeleteWorkspaceOrDb={(action, id, label) => {
                  if (confirm(`確定要刪除「${label}」？`)) {
                    wsActions.deleteWorkspaceOrDb(action, id)
                  }
                }}
                onDeleteTable={async (tableId, tableName) => {
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
                onCreateFromTemplate={handleCreateDatabaseFromTemplate}
              />
            </div>
          ) : (
            <TableWorkspaceView
              isSidebarCollapsed={isSidebarCollapsed}
              setIsSidebarCollapsed={setIsSidebarCollapsed}
              currentUserRolePermissions={currentUserRolePermissions}
              currentUser={authState.currentUser}
              activeWorkspaceId={wsState.activeWorkspaceId}
              workspaces={wsState.workspaces}
              unreadNotificationsCount={unreadNotificationsCount}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortField={sortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              filterType={filterType}
              setFilterType={setFilterType}
              groupByField={groupByField}
              setGroupByField={setGroupByField}
              groupCollapseState={groupCollapseState}
              setGroupCollapseState={setGroupCollapseState}
              rowHeightSize={rowHeightSize}
              setRowHeightSize={setRowHeightSize}
              frozenColumnsCount={frozenColumnsCount}
              applyViewConfig={applyViewConfig}
              handleDuplicateView={handleDuplicateView}
              handleDeleteViewById={handleDeleteViewById}
              handleRenameViewById={handleRenameViewById}
              handleExportCSV={handleExportCSV}
              handleCSVImport={handleCSVImport}
              csvInputRef={csvInputRef}
              setShowAirtableModal={setShowAirtableModal}
              setShowNewViewModal={setShowNewViewModal}
              setShowMembersModal={setShowMembersModal}
              setShowNotificationsModal={setShowNotificationsModal}
              setShowUserSettingsModal={setShowUserSettingsModal}
              toggleTheme={themeActions.toggleTheme}
              toggleDarkReaderPanel={() => themeActions.setShowDarkReaderPanel(!themeState.showDarkReaderPanel)}
              logout={authActions.logout}
              canUndo={canUndo}
              canRedo={canRedo}
              undo={undo}
              redo={redo}
              editingFieldId={editingFieldId}
              setEditingFieldId={setEditingFieldId}
              editingFieldName={editingFieldName}
              setEditingFieldName={setEditingFieldName}
              editingCell={editingCell}
              editInputRef={editInputRef}
              handleColumnDragStart={handleColumnDragStart}
              handleColumnDragOver={handleColumnDragOver}
              handleColumnDrop={handleColumnDrop}
              handleReorderRows={handleReorderRows}
              setContextMenu={setContextMenu}
              setNewFieldPopoverPos={setNewFieldPopoverPos}
              onSelectDashboard={() => wsActions.setActiveTableId(0)}
              onSetActiveWorkspaceId={wsActions.setActiveWorkspaceId}
              onSetActiveTableId={wsActions.setActiveTableId}
              addToast={uiActions.addToast}
              isOffline={isOffline}
              newFieldScrollTrigger={newFieldScrollTrigger}
            />
          )}
        </div>

        {/* Mobile Global Bottom Navigation Floating Bubble (LIVBubbleMenu) */}
        <MobileBottomNav
          workspaces={wsState.workspaces}
          activeWorkspaceId={wsState.activeWorkspaceId}
          activeTableId={wsState.activeTableId}
          currentUser={authState.currentUser}
          notificationCount={unreadNotificationsCount}
          fields={fields}
          rows={rows}
          onSelectDashboard={() => wsActions.setActiveTableId(0)}
          onSetActiveWorkspaceId={wsActions.setActiveWorkspaceId}
          onSetActiveTableId={wsActions.setActiveTableId}
          onShowNotificationsModal={() => setShowNotificationsModal(true)}
          onShowUserSettingsModal={() => setShowUserSettingsModal(true)}
          onToggleTheme={themeActions.toggleTheme}
          onToggleDarkReaderPanel={() => themeActions.setShowDarkReaderPanel(!themeState.showDarkReaderPanel)}
          onLogout={authActions.logout}
          onSelectRow={(row) => {
            setSelectedRow(row)
            setShowDetailModal(true)
          }}
          onImportAirtable={() => setShowAirtableModal(true)}
        />
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
        onFieldCreated={handleFieldCreated}
        newFieldPopoverPos={newFieldPopoverPos}
        setNewFieldPopoverPos={setNewFieldPopoverPos}
        editingFieldForModal={editingFieldForModal}
        setEditingFieldForModal={setEditingFieldForModal}
        currentUserRolePermissions={currentUserRolePermissions}
        currentUser={authState.currentUser}
        showMembersModal={showMembersModal}
        setShowMembersModal={setShowMembersModal}
        setWorkspaceMemberCount={setWorkspaceMemberCount}
        showNotificationsModal={showNotificationsModal}
        setShowNotificationsModal={setShowNotificationsModal}
        onRefreshRows={async () => { if (wsState.activeTableId) await fetchTableData(wsState.activeTableId) }}
        onOpenAirtableImport={() => setShowAirtableModal(true)}
      />

      {/* User Account & Subscription Modals - Always Mounted */}
      {authState.currentUser && (
        <UserSettingsModal
          show={showUserSettingsModal}
          onClose={() => setShowUserSettingsModal(false)}
          currentUser={authState.currentUser}
          onToast={uiActions.addToast}
          onToggleTheme={themeActions.toggleTheme}
          onToggleDarkReaderPanel={() => themeActions.setShowDarkReaderPanel(!themeState.showDarkReaderPanel)}
          onLogout={authActions.logout}
          onUpdateProfile={async (updates) => {
            const res = await authActions.updateProfile(updates)
            if (res.ok) {
              await wsActions.fetchWorkspaces()
            }
            return res
          }}
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

      <AirtableImportModal
        isOpen={showAirtableModal}
        onClose={() => setShowAirtableModal(false)}
        activeWorkspaceId={wsState.activeWorkspaceId}
        onSuccess={async () => {
          uiActions.addToast('Airtable 匯入成功！', 'success')
          await wsActions.fetchWorkspaces()
        }}
      />
    </div>
    </TableProvider>
  )
}
