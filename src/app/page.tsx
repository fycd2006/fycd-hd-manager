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
import { AirtableImportModal } from '@/modules/database/components/import/AirtableImportModal'
import MembersModal from '@/modules/database/components/modals/MembersModal'
import NotificationsModal from '@/modules/database/components/modals/NotificationsModal'
import UserSettingsModal from '@/modules/database/components/modals/UserSettingsModal'
import SubscriptionModal from '@/modules/database/components/modals/SubscriptionModal'
import DarkReaderModal from '@/modules/database/components/modals/DarkReaderModal'
import { getRolePermissions } from '@/lib/permissions'
import { getSessionUser } from '@/lib/auth'
import { useTableOperations } from '@/modules/database/hooks/useTableOperations'
import { evaluateFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'
import { getPusherClient, getSocketId } from '@/lib/pusher-client'
import GridView from '@/modules/database/components/table/GridView'
import { FieldContextMenu } from '@/modules/database/components/menu/FieldContextMenu'
import { parseSelectItems, evaluateCellCondition } from '@/modules/database/components/views/grid/cells/utils'
import { useI18n } from '@/lib/i18n/i18nContext'
import { FIELD_TYPE_ICONS, FIELD_TYPE_LABELS, Icons } from '@/modules/database/constants'
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

  // View configuration
  const [views, setViews] = useState<TableView[]>([])
  const [currentView, setCurrentView] = useState<ViewType>('grid')
  const [showNewViewModal, setShowNewViewModal] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [newViewType, setNewViewType] = useState<ViewType>('grid')

  // Sort & Filter
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [sortRules, setSortRules] = useState<SortRule[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterRules, setFilterRules] = useState<FilterRule[]>([])
  const [filterType, setFilterType] = useState<'AND' | 'OR'>('AND')

  // Hidden Fields & Row Colors Config
  const [hiddenFieldKeys, setHiddenFieldKeys] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [showHiddenFieldsPanel, setShowHiddenFieldsPanel] = useState(false)
  const [rowColorRules, setRowColorRules] = useState<RowColorRule[]>([])
  const [showRowColorsPanel, setShowRowColorsPanel] = useState(false)
  const [showGroupByPanel, setShowGroupByPanel] = useState(false)
  const [groupByField, setGroupByField] = useState<string | null>(null)
  const [groupByRules, setGroupByRules] = useState<GroupByRule[]>([])

  // Modals
  const [showNewFieldModal, setShowNewFieldModal] = useState(false)
  const [newFieldPopoverPos, setNewFieldPopoverPos] = useState<{ top: number; left: number } | null>(null)
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
  const cellAbortMap = useRef<Map<string, AbortController>>(new Map())
  const cellSeqMap = useRef<Map<string, number>>(new Map())
  const cellDebounceMap = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const batchUpdateCellsRef = useRef<(updates: Array<{ rowId: number; data: Record<string, any> }>) => Promise<void>>(async () => { })

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
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement).isContentEditable
      )

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

  const applyViewConfig = useCallback((view: TableView) => {
    setCurrentView(view.type)

    const safeParse = (val: any, fallback: any) => {
      if (!val) return fallback
      try {
        let parsed = typeof val === 'string' ? JSON.parse(val) : val
        if (typeof parsed === 'string') parsed = JSON.parse(parsed) // Handle legacy double-stringified JSON
        return parsed ?? fallback
      } catch {
        return fallback
      }
    }

    const parsedSortRules = safeParse(view.sortRules || view.sortField, null)
    if (Array.isArray(parsedSortRules) && parsedSortRules.length > 0) {
      setSortRules(parsedSortRules)
      setSortField(parsedSortRules[0].fieldKey)
      setSortOrder(parsedSortRules[0].order || 'asc')
    } else if (typeof view.sortField === 'string' && view.sortField) {
      if (view.sortField.startsWith('[')) {
        try {
          const arr = JSON.parse(view.sortField)
          if (Array.isArray(arr) && arr.length > 0) {
            setSortRules(arr)
            setSortField(arr[0].fieldKey)
            setSortOrder(arr[0].order || 'asc')
          }
        } catch {
          setSortRules([{ fieldKey: view.sortField, order: view.sortOrder || 'asc' }])
          setSortField(view.sortField)
          setSortOrder(view.sortOrder || 'asc')
        }
      } else {
        setSortRules([{ fieldKey: view.sortField, order: view.sortOrder || 'asc' }])
        setSortField(view.sortField)
        setSortOrder(view.sortOrder || 'asc')
      }
    } else {
      setSortRules([])
      setSortField(null)
      setSortOrder('asc')
    }

    const parsedFilters = safeParse(view.filters, [])
    if (parsedFilters && typeof parsedFilters === 'object' && !Array.isArray(parsedFilters)) {
      setFilterRules(Array.isArray(parsedFilters.rules) ? parsedFilters.rules : [])
      setFilterType(parsedFilters.filterType === 'OR' ? 'OR' : 'AND')
    } else {
      setFilterRules(Array.isArray(parsedFilters) ? parsedFilters : [])
      setFilterType(view.filterType === 'OR' ? 'OR' : 'AND')
    }

    const parsedHidden = safeParse(view.hiddenFields, [])
    setHiddenFieldKeys(Array.isArray(parsedHidden) ? parsedHidden : [])

    const parsedColors = safeParse(view.rowColors, [])
    setRowColorRules(Array.isArray(parsedColors) ? parsedColors : [])

    const parsedWidths = safeParse(view.columnWidths, {})
    setColumnWidths(typeof parsedWidths === 'object' && parsedWidths !== null && !Array.isArray(parsedWidths) ? parsedWidths : {})

    const parsedGroupBy = safeParse(view.groupByRules || view.groupByField, null)
    if (Array.isArray(parsedGroupBy)) {
      setGroupByRules(parsedGroupBy)
      setGroupByField(parsedGroupBy.length > 0 ? parsedGroupBy[0].fieldKey : null)
    } else if (typeof view.groupByField === 'string' && view.groupByField) {
      if (view.groupByField.startsWith('[')) {
        try {
          const arr = JSON.parse(view.groupByField)
          if (Array.isArray(arr)) {
            setGroupByRules(arr)
            setGroupByField(arr.length > 0 ? arr[0].fieldKey : null)
          }
        } catch {
          setGroupByRules([{ fieldKey: view.groupByField, order: 'asc' }])
          setGroupByField(view.groupByField)
        }
      } else {
        setGroupByRules([{ fieldKey: view.groupByField, order: 'asc' }])
        setGroupByField(view.groupByField)
      }
    } else {
      setGroupByRules([])
      setGroupByField(null)
    }
  }, [])

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
        setViews([])
        setCurrentView('grid')
        setFilterRules([])
        setHiddenFieldKeys([])
        setRowColorRules([])
        setColumnWidths({})
        setSortField(null)
        setSortOrder('asc')
        setGroupByField(null)
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
  }, [uiActions, mergeServerRows, t, wsActions, applyViewConfig])

  // Real-time multi-user WebSocket synchronization via Pusher
  useEffect(() => {
    if (!wsState.activeTableId) return
    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = `table-${wsState.activeTableId}`
    const channel = pusher.subscribe(channelName)

    const handleStateChange = (states: { previous: string; current: string }) => {
      if (['unavailable', 'disconnected', 'failed'].includes(states.current)) {
        uiActions.addToast('網路連線中斷，正在嘗試重新連線...', 'info')
      } else if (['unavailable', 'disconnected', 'failed', 'connecting'].includes(states.previous) && states.current === 'connected') {
        uiActions.addToast('網路已重新連線，正在進行全量資料同步...', 'info')
        if (wsState.activeTableId) {
          fetchTableData(wsState.activeTableId)
        }
      }
    }

    if (pusher.connection) {
      pusher.connection.bind('state_change', handleStateChange)
    }

    channel.bind('row-updated', (data: any) => {
      if (!data) return
      const { rowId, data: rowData, affectedRows } = data

      setRows(prev => prev.map(r => {
        if (r.id === rowId && rowData) {
          const newData = { ...r.data, ...rowData }
          Object.keys(newData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newData)) newData[`field_${k}`] = newData[k]; delete newData[k] } })
          return { ...r, data: newData }
        }
        return r
      }))

      if (Array.isArray(affectedRows) && affectedRows.length > 0) {
        const affectedMap = new Map<number, Record<string, any>>()
        affectedRows.forEach((ar: any) => affectedMap.set(ar.id, ar.data || {}))
        setRows(prev => prev.map(r => {
          if (affectedMap.has(r.id)) {
            const newData = { ...r.data, ...affectedMap.get(r.id) }
            Object.keys(newData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newData)) newData[`field_${k}`] = newData[k]; delete newData[k] } })
            return { ...r, data: newData }
          }
          return r
        }))
      }
    })

    channel.bind('rows-batch-updated', (data: any) => {
      if (!data || !Array.isArray(data.updates)) return
      const updateMap = new Map<number, Record<string, any>>()
      data.updates.forEach((u: any) => updateMap.set(u.rowId, u.data || {}))
      setRows(prev => prev.map(r => {
        if (updateMap.has(r.id)) {
          const newData = { ...r.data, ...updateMap.get(r.id) }
          Object.keys(newData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newData)) newData[`field_${k}`] = newData[k]; delete newData[k] } })
          return { ...r, data: newData }
        }
        return r
      }))
    })

    channel.bind('row-created', (data: any) => {
      if (!data?.row) return
      setRows(prev => {
        if (prev.some(r => r.id === data.row.id)) return prev
        return [...prev, data.row]
      })
    })

    channel.bind('row-deleted', (data: any) => {
      if (!data?.rowId) return
      setRows(prev => prev.filter(r => r.id !== data.rowId))
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(channelName)
    }
  }, [wsState.activeTableId])

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

  // Load table data when activeTableId changes
  useEffect(() => {
    if (wsState.activeTableId) {
      fetchTableData(wsState.activeTableId)
    }
  }, [wsState.activeTableId, fetchTableData])

  // Cell or multi-field row update using new service
  const updateCell = async (rowId: number, fieldKeyOrId: any, value?: CellValue, skipPushHistory: boolean = false) => {
    if (!wsState.activeTableId) return
    const targetRow = rows.find(r => r.id === rowId)
    const targetTableId = targetRow?.tableId || wsState.activeTableId

    try {
      // Handle batch multi-field update for a row
      if (typeof fieldKeyOrId === 'object' && fieldKeyOrId !== null) {
        const dataMap: Record<string, any> = fieldKeyOrId
        const socketId = getSocketId()
        // Optimistically update all fields of this row in React state immediately
        setRows(prev => prev.map(r => {
          if (r.id !== rowId) return r
          return { ...r, data: { ...r.data, ...dataMap } }
        }))

        const res = await fetch(`/api/tables/${targetTableId}/rows`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowId, data: dataMap, socket_id: socketId }),
        })
        const result = await res.json()

        if (res.ok && result.data) {
          setRows(prev => prev.map(r => {
            if (r.id !== rowId) return r
            return { ...r, data: { ...r.data, ...result.data } }
          }))

          if (Array.isArray(result.affectedRows) && result.affectedRows.length > 0) {
            const affectedMap = new Map<number, Record<string, any>>()
            result.affectedRows.forEach((ar: any) => affectedMap.set(ar.id, ar.data || {}))
            setRows(prev => prev.map(r => {
              if (affectedMap.has(r.id)) {
                return { ...r, data: { ...r.data, ...affectedMap.get(r.id) } }
              }
              return r
            }))
          }
        }
        return
      }

      const fieldKey = typeof fieldKeyOrId === 'number'
        ? `field_${fieldKeyOrId}`
        : (String(fieldKeyOrId).startsWith('field_') ? String(fieldKeyOrId) : `field_${fieldKeyOrId}`)

      const fieldId = parseInt(fieldKey.replace('field_', ''))
      const field = fields.find(f => f.id === fieldId)

      let payloadValue: CellValue = value ?? null
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

      // Optimistically update UI state immediately and recompute formulas locally
      const safeVal = value ?? null
      const formulaFields = fields.filter(f => f.type === 'formula')
      setRows(prev => prev.map(r => {
        if (r.id !== rowId) return r
        const updatedData = { ...r.data, [fieldKey]: safeVal }
        Object.keys(updatedData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in updatedData)) updatedData[`field_${k}`] = updatedData[k]; delete updatedData[k] } })
        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = ff.options
          if (!expr) return
          if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
            try {
              let parsed = JSON.parse(expr)
              if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed) } catch { } }
              if (parsed && typeof parsed === 'object' && parsed.formula) expr = parsed.formula
            } catch { }
          }
          try {
            const fieldOrder = fields.map(f => f.id)
            const res = evaluateFormula(expr, updatedData as any, fieldOrder)
            updatedData[destKey] = res != null ? String(res) : ''
          } catch {
            updatedData[destKey] = '#VALUE!'
          }
        })
        return { ...r, data: updatedData }
      }))

      const cellKey = `${targetTableId}_${rowId}_${fieldKey}`
      
      // Clear existing debounce timer if user is rapidly clicking/typing on the same field
      if (cellDebounceMap.current.has(cellKey)) {
        clearTimeout(cellDebounceMap.current.get(cellKey)!)
      }

      // 300ms Debounce + AbortController + 12s Timeout Dual-Layer Protection
      const timer = setTimeout(async () => {
        if (cellAbortMap.current.has(cellKey)) {
          cellAbortMap.current.get(cellKey)?.abort()
        }
        const controller = new AbortController()
        cellAbortMap.current.set(cellKey, controller)
        const seqId = (cellSeqMap.current.get(cellKey) || 0) + 1
        cellSeqMap.current.set(cellKey, seqId)

        // 12-second Operation Timeout
        const timeoutId = setTimeout(() => {
          controller.abort()
          uiActions.addToast('操作逾時 (12 秒未獲確認)，請檢查網路並重試', 'info')
        }, 12000)

        try {
          const result = await rowService.updateCell(targetTableId, rowId, fieldKey, payloadValue, { signal: controller.signal })
          clearTimeout(timeoutId)

          if (cellSeqMap.current.get(cellKey) !== seqId) {
            // Obsolete response from older request -> drop
            return
          }

          if (result.ok) {
            if (result.row) {
              const serverData = typeof result.row.data === 'string'
                ? (safeJsonParse(result.row.data, {}) as Record<string, any>)
                : (result.row.data || {})

              setRows(prev => prev.map(r => {
                if (r.id !== rowId) return r
                const mergedData = { ...r.data }
                if (fieldKey in serverData) {
                  mergedData[fieldKey] = serverData[fieldKey]
                }
                fields.forEach(f => {
                  const key = `field_${f.id}`
                  if (['formula', 'lookup', 'rollup', 'last_modified_on', 'last_modified_by', 'created_on', 'created_by', 'autonumber'].includes(f.type)) {
                    if (key in serverData) {
                      mergedData[key] = serverData[key]
                    }
                  }
                })
                Object.keys(mergedData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in mergedData)) mergedData[`field_${k}`] = mergedData[k]; delete mergedData[k] } })
                return { ...r, data: mergedData }
              }))
            }

            const affectedRows = (result.row as any)?.affectedRows
            if (Array.isArray(affectedRows) && affectedRows.length > 0) {
              const affectedMap = new Map<number, Record<string, any>>()
              affectedRows.forEach((ar: any) => affectedMap.set(ar.id, ar.data || {}))

              setRows(prev => prev.map(r => {
                if (affectedMap.has(r.id)) {
                  const newData = { ...r.data, ...affectedMap.get(r.id) }
                  Object.keys(newData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newData)) newData[`field_${k}`] = newData[k]; delete newData[k] } })
                  return { ...r, data: newData }
                }
                return r
              }))
            }

            if (!skipPushHistory) {
              pushEdit({
                tableId: targetTableId,
                edits: [{ rowId, fieldKey, before: oldValue, after: payloadValue }]
              })
            }
          } else {
            setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldKey]: oldValue } } : r))
            uiActions.addToast('更新儲存格失敗', 'error')
          }
        } catch (err: any) {
          clearTimeout(timeoutId)
          if (err.name === 'AbortError') return
          uiActions.addToast('更新儲存格時發生網路或系統錯誤', 'error')
        }
      }, 300)

      cellDebounceMap.current.set(cellKey, timer)
    } catch {
      uiActions.addToast('更新儲存格時發生網路或系統錯誤', 'error')
    }
  }

  // Expose helpers for E2E automated resilience testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as any).updateCell = updateCell
      ;(window as any).fetchTableData = fetchTableData
      ;(window as any).dispatchTableOp = dispatch
      ;(window as any).rows = rows
      ;(window as any).fields = fields
    }
  }, [updateCell, fetchTableData, dispatch, rows, fields])

  const batchUpdateCells = async (updates: Array<{ rowId: number; data: Record<string, any> }>) => {
    if (!wsState.activeTableId || !Array.isArray(updates) || updates.length === 0) return
    const firstRowId = updates[0]?.rowId
    const targetRow = rows.find(r => r.id === firstRowId)
    const targetTableId = targetRow?.tableId || wsState.activeTableId

    // Collect before states for all updated rows & fields for undo history
    const historyEdits: Array<{ rowId: number; fieldKey: string; before: any; after: any }> = []
    updates.forEach(u => {
      const r = rows.find(row => row.id === u.rowId)
      if (r && u.data) {
        Object.entries(u.data).forEach(([fk, val]) => {
          historyEdits.push({
            rowId: u.rowId,
            fieldKey: fk,
            before: r.data[fk] ?? null,
            after: val
          })
        })
      }
    })

    try {
      // Optimistically update React state for ALL target rows immediately in 0ms
      const updateMap = new Map<number, Record<string, any>>()
      updates.forEach(u => updateMap.set(u.rowId, u.data))
      setRows(prev => prev.map(r => {
        if (updateMap.has(r.id)) {
          const sData = updateMap.get(r.id) || {}
          const newRowData = { ...r.data, ...sData }
          Object.keys(newRowData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newRowData)) newRowData[`field_${k}`] = newRowData[k]; delete newRowData[k] } })
          const newValues = (r as any).values ? { ...(r as any).values } : undefined
          if (newValues) {
            Object.entries(sData).forEach(([k, v]) => {
              const fid = parseInt(k.replace('field_', ''))
              if (!isNaN(fid)) newValues[fid] = v
            })
          }
          return { ...r, data: newRowData, ...(newValues && { values: newValues }) }
        }
        return r
      }))

      // Send 1 SINGLE HTTP request to batch update API
      const result = await rowService.batchUpdateRows(targetTableId, updates)
      if (result.ok && Array.isArray(result.updates)) {
        if (historyEdits.length > 0) {
          pushEdit({
            tableId: targetTableId,
            edits: historyEdits
          })
        }
        const serverMap = new Map<number, Record<string, any>>()
        result.updates.forEach(u => serverMap.set(u.rowId, u.data))
        setRows(prev => prev.map(r => {
          if (serverMap.has(r.id)) {
            const sData = serverMap.get(r.id) || {}
            const newRowData = { ...r.data, ...sData }
            Object.keys(newRowData).forEach(k => { if (/^\d+$/.test(k)) { if (!(`field_${k}` in newRowData)) newRowData[`field_${k}`] = newRowData[k]; delete newRowData[k] } })
            const newValues = (r as any).values ? { ...(r as any).values } : undefined
            if (newValues) {
              Object.entries(sData).forEach(([k, v]) => {
                const fid = parseInt(k.replace('field_', ''))
                if (!isNaN(fid)) newValues[fid] = v
              })
            }
            return { ...r, data: newRowData, ...(newValues && { values: newValues }) }
          }
          return r
        }))
      }
    } catch (err) {
      console.error('Batch update failed:', err)
      uiActions.addToast('批次更新失敗', 'error')
    }
  }

  updateCellRef.current = updateCell
  batchUpdateCellsRef.current = batchUpdateCells

  // Add row using new service
  const addRow = async (overrides?: Record<string, CellValue>) => {
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

      if (overrides) {
        Object.assign(baseData, overrides)
      }

      const result = await rowService.createRow(wsState.activeTableId, baseData)
      if (result.ok && result.row) {
        setRows(prev => [...prev, result.row!])

        fetch(`/api/tables/${wsState.activeTableId}/rows/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId: result.row!.id,
            content: `[HISTORY] 建立了此資料列`
          })
        }).catch(() => { })

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

  // Batch add multiple rows
  const batchAddRows = async (rowsToCreate: Array<Record<string, any>>) => {
    if (!wsState.activeTableId || rowsToCreate.length === 0) return
    try {
      const createdRows: TableRow[] = []
      for (const rowData of rowsToCreate) {
        let baseData: Record<string, CellValue> = {}
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
        Object.assign(baseData, rowData)
        const result = await rowService.createRow(wsState.activeTableId, baseData)
        if (result.ok && result.row) {
          createdRows.push(result.row as any)
        }
      }
      if (createdRows.length > 0) {
        setRows(prev => [...prev, ...createdRows])
        uiActions.addToast(`成功新增 ${createdRows.length} 列資料`, 'success')
      }
    } catch {
      uiActions.addToast('批次新增列失敗', 'error')
    }
  }

  // Move operations (Cross-table cut and paste)
  const stageMoveRows = useCallback((rowIds: number[]) => {
    if (!wsState.activeTableId || rowIds.length === 0) return
    const id = `move_${Date.now()}`
    
    const rowsDataToMove = rows.filter(r => rowIds.includes(r.id)).map(r => ({
      sourceRowId: r.id,
      data: r.data
    }))
    
    if (rowsDataToMove.length === 0) return

    dispatch({
      type: 'ADD_OPERATION',
      payload: {
        id,
        type: 'move',
        status: 'staged',
        tableId: wsState.activeTableId,
        sourceRowIds: rowIds,
        rowsData: rowsDataToMove,
        createdAt: Date.now()
      }
    })
  }, [wsState.activeTableId, rows, dispatch])

  const cancelMoveRows = useCallback(() => {
    operations.forEach(op => {
      if (op.type === 'move' && op.status === 'staged') {
        dispatch({ type: 'REMOVE_OPERATION', payload: op.id })
      }
    })
  }, [operations, dispatch])

  const batchMoveRows = useCallback((): boolean => {
    const stagedOp = operations.find(op => op.type === 'move' && op.status === 'staged')
    if (!stagedOp || !wsState.activeTableId || !stagedOp.rowsData) return false

    const sourceTableId = stagedOp.tableId!
    const targetTableId = wsState.activeTableId
    const rowsToMove = stagedOp.rowsData
    
    const clientIds: string[] = []
    const movePayload = rowsToMove.map(r => {
      const clientId = `move_tmp_${Date.now()}_${Math.random().toString(36).substring(7)}`
      clientIds.push(clientId)
      return {
        sourceRowId: r.sourceRowId,
        data: r.data,
        clientId,
        order: 0
      }
    })

    dispatch({ type: 'REMOVE_OPERATION', payload: stagedOp.id })
    const pendingOpId = `move_pending_${Date.now()}`
    dispatch({
      type: 'ADD_OPERATION',
      payload: {
        id: pendingOpId,
        type: 'move',
        status: 'pending',
        tableId: sourceTableId,
        targetTableId: targetTableId,
        createdAt: Date.now()
      }
    })

    fetch(`/api/tables/${targetTableId}/rows/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceTableId,
        rows: movePayload,
        socket_id: getSocketId()
      })
    })
    .then(res => res.json())
    .then(data => {
      dispatch({ type: 'REMOVE_OPERATION', payload: pendingOpId })
      if (data.success && data.createdRows) {
        uiActions.addToast(`成功搬移 ${data.createdRows.length} 筆資料`, 'success')
        if (targetTableId === wsState.activeTableId) {
           fetchTableData(targetTableId)
        }
      } else {
        uiActions.addToast(data.error || '搬移失敗', 'error')
      }
    })
    .catch(() => {
      dispatch({ type: 'REMOVE_OPERATION', payload: pendingOpId })
      uiActions.addToast('搬移失敗', 'error')
    })
    
    return true
  }, [operations, wsState.activeTableId, dispatch, fetchTableData, uiActions])

  // Reorder rows (Drag & Drop with DB persistence & Cross-Group field sync)
  const handleReorderRows = async (srcIdx: number, targetIdx: number) => {
    if (!wsState.activeTableId || srcIdx === targetIdx) return
    const sourceRow = displayRows[srcIdx]
    const targetRow = displayRows[targetIdx]
    if (!sourceRow || !targetRow) return

    // Check if dragging across groups
    const effectiveGroups = groupByRules && groupByRules.length > 0
      ? groupByRules
      : (groupByField ? [{ fieldKey: groupByField, order: 'asc' as const }] : []);

    let fieldUpdates: Record<string, any> | null = null;
    if (effectiveGroups.length > 0) {
      effectiveGroups.forEach(grp => {
        const targetVal = targetRow.data?.[grp.fieldKey] ?? targetRow.data?.[grp.fieldKey.replace('field_', '')];
        const srcVal = sourceRow.data?.[grp.fieldKey] ?? sourceRow.data?.[grp.fieldKey.replace('field_', '')];
        if (targetVal !== undefined && targetVal !== srcVal) {
          if (!fieldUpdates) fieldUpdates = {};
          fieldUpdates[grp.fieldKey] = targetVal;
        }
      });
    }

    // Reorder within displayRows (which respects current sort/group rendering)
    const newDisplayOrder = [...displayRows]
    let [moved] = newDisplayOrder.splice(srcIdx, 1)
    if (fieldUpdates) {
      const updates: Record<string, any> = fieldUpdates
      const currentData: Record<string, any> = typeof moved.data === 'object' && moved.data !== null ? moved.data : {}
      moved = { ...moved, data: Object.assign({}, currentData, updates) }
    }
    newDisplayOrder.splice(targetIdx, 0, moved)

    // Build new full rows array: rows NOT in displayRows stay in their relative positions,
    // rows IN displayRows get new order values based on their new display position.
    const displayRowIds = new Set(displayRows.map(r => r.id))
    const nonDisplayRows = rows.filter(r => !displayRowIds.has(r.id))
    // Assign order 0..N-1 to display rows in their new order, then append non-display rows after
    const reorderedDisplayRows = newDisplayOrder.map((r, idx) => ({ ...r, order: idx }))
    const nonDisplayWithOrder = nonDisplayRows.map((r, idx) => ({ ...r, order: reorderedDisplayRows.length + idx }))
    const updatedRows = [...reorderedDisplayRows, ...nonDisplayWithOrder]

    setRows(updatedRows)

    const rowIds = newDisplayOrder.map(r => r.id)
    console.log('[Reorder] rowIds to send:', rowIds)
    console.log('[Reorder] tableId:', wsState.activeTableId)
    console.log('[Reorder] activeViewId:', wsState.activeViewId)

    // Clear sort so server order is respected after reload
    if (sortField || (sortRules && sortRules.length > 0)) {
      setSortField(null)
      setSortRules([])
      setSortOrder('asc')
      if (wsState.activeViewId) {
        // Note: sortRules is not a DB column — only clear sortField in the view
        await saveViewConfig(wsState.activeViewId, { sortField: null, sortOrder: 'asc' })
        console.log('[Reorder] cleared sort from view', wsState.activeViewId)
      }
    }

    try {
      if (fieldUpdates) {
        await rowService.updateRow(wsState.activeTableId, sourceRow.id, fieldUpdates);
      }
      const res = await rowService.reorderRows(wsState.activeTableId, rowIds)
      console.log('[Reorder] API result:', res)
      if (res.ok) {
        uiActions.addToast('已儲存資料列順序', 'success')
      } else {
        console.error('[Reorder] FAILED:', res.error)
        uiActions.addToast(res.error || '儲存資料列順序失敗', 'error')
        setRows(rows)
      }
    } catch (e) {
      console.error('[Reorder] exception:', e)
      uiActions.addToast('儲存資料列順序失敗', 'error')
      setRows(rows)
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

          let diff = 0
          if (fieldObj?.type === 'single_select' || fieldObj?.type === 'multiple_select') {
            const namesA = parseSelectItems(rawA, fieldObj.options).join(', ')
            const namesB = parseSelectItems(rawB, fieldObj.options).join(', ')
            diff = namesA.localeCompare(namesB, 'zh-TW', { numeric: true })
          } else {
            const numA = Number(rawA)
            const numB = Number(rawB)
            if (!isNaN(numA) && !isNaN(numB) && rawA !== '' && rawB !== '') {
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
  }

  const displayRows = getDisplayRows()

  // Get row background color
  const getRowBgColorClass = (row: TableRow) => {
    if (rowColorRules.length === 0) return ''
    const matched = rowColorRules.find(rule => {
      const field = fields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey || f.name === rule.fieldKey)
      const val = row.data[rule.fieldKey]
      return evaluateCellCondition(val, field, rule.operator, rule.value)
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
      saveViewConfig(wsState.activeViewId, { sortField: nextField, sortOrder: nextOrder })
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
      saveViewConfig(wsState.activeViewId, { hiddenFields: nextHidden })
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
        ...(changes.aggregations !== undefined && {
          aggregations: typeof changes.aggregations === 'string' || changes.aggregations === null ? changes.aggregations : JSON.stringify(changes.aggregations)
        }),
      }

      // Optimistically update local views list
      setViews(prev => prev.map(v => v.id === updatedViewId ? { ...v, ...(serializedChanges as any) } : v))

      await viewService.updateViewConfig(wsState.activeTableId, updatedViewId, serializedChanges)
    } catch { }
  }

  const createView = async (name: string, type: ViewType) => {
    if (!name.trim() || !wsState.activeTableId) return
    try {
      const result = await viewService.createView(wsState.activeTableId, name.trim(), type)
      if (result.ok && result.view) {
        setViews(prev => [...prev, result.view!])
        wsActions.setActiveViewId(result.view!.id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${wsState.activeTableId}`, String(result.view!.id))
        }
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${wsState.activeTableId}`, String(remaining[0].id))
        }
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
        const viewConfig: ViewConfigPatch = {
          filters: sourceView.filters,
          sortField: sourceView.sortField,
          sortOrder: sourceView.sortOrder,
          hiddenFields: sourceView.hiddenFields,
          columnWidths: sourceView.columnWidths,
          rowColors: sourceView.rowColors,
          groupByField: sourceView.groupByField,
          aggregations: sourceView.aggregations,
        }
        await saveViewConfig(result.view.id, viewConfig)
        const fullView: TableView = {
          ...result.view,
          ...viewConfig,
          filters: typeof viewConfig.filters === 'string' || viewConfig.filters === null ? viewConfig.filters : JSON.stringify(viewConfig.filters),
          hiddenFields: typeof viewConfig.hiddenFields === 'string' || viewConfig.hiddenFields === null ? viewConfig.hiddenFields : JSON.stringify(viewConfig.hiddenFields),
          columnWidths: typeof viewConfig.columnWidths === 'string' || viewConfig.columnWidths === null ? viewConfig.columnWidths : JSON.stringify(viewConfig.columnWidths),
          rowColors: typeof viewConfig.rowColors === 'string' || viewConfig.rowColors === null ? viewConfig.rowColors : JSON.stringify(viewConfig.rowColors),
          aggregations: typeof viewConfig.aggregations === 'string' || viewConfig.aggregations === null ? viewConfig.aggregations : JSON.stringify(viewConfig.aggregations),
        } as TableView
        setViews(prev => [...prev.filter(v => v.id !== result.view!.id), fullView])
        wsActions.setActiveViewId(result.view.id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${wsState.activeTableId}`, String(result.view.id))
        }
        applyViewConfig(fullView)
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
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${wsState.activeTableId}`, String(remaining[0].id))
        }
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

  // Show unified App Shell skeleton during initial load & authentication check
  // Show unified App Shell skeleton during initial load & authentication check
  if (authState.authLoading) {
    const isDark = themeState.theme === 'dark'
    return (
      <div className={`app-container theme-${themeState.theme}`} style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: isDark ? '#0f172a' : '#fafafa' }}>
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
                    backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'success' ? '#16a34a' : '#3F6212',
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

  const activeWorkspaceObj = wsState.workspaces.find(w => w.id === wsState.activeWorkspaceId)
  const activeMember = activeWorkspaceObj?.members?.find((m: any) => m.userId === authState.currentUser?.id)
  const currentUserRolePermissions = getRolePermissions(activeMember?.role || authState.currentUser?.role || 'admin')

  const handleCreateDatabaseFromTemplate = async (templateKey: 'project' | 'crm' | 'finance' | 'hr') => {
    if (!activeWorkspaceObj) return

    const templateMap = {
      project: {
        dbName: '🚀 專案任務追蹤資料庫',
        tableName: '專案任務表',
        fields: [
          { name: '任務名稱', type: 'text' },
          { name: '狀態', type: 'single_select', options: JSON.stringify(['未開始', '進行中', '已完成']) },
          { name: '優先級', type: 'single_select', options: JSON.stringify(['低', '中', '高', '緊急']) },
          { name: '負責人', type: 'text' },
          { name: '截止日期', type: 'date' }
        ],
        sampleRows: [
          { field_1: '設計官網新版 UI 首頁', field_2: '進行中', field_3: '高', field_4: 'Alex', field_5: '2026-08-01' },
          { field_1: '撰寫資料庫 API 文件', field_2: '未開始', field_3: '中', field_4: 'Bob', field_5: '2026-08-05' },
          { field_1: '修復 Formula 欄位編輯', field_2: '已完成', field_3: '緊急', field_4: 'Carol', field_5: '2026-07-24' }
        ]
      },
      crm: {
        dbName: '💼 客戶關係 CRM 資料庫',
        tableName: '客戶資料表',
        fields: [
          { name: '客戶姓名', type: 'text' },
          { name: '公司名稱', type: 'text' },
          { name: '聯絡電話', type: 'text' },
          { name: '電子郵件', type: 'email' },
          { name: '交易金額', type: 'number' },
          { name: '狀態', type: 'single_select', options: JSON.stringify(['潛在客戶', '商談中', '已成交', '已流失']) }
        ],
        sampleRows: [
          { field_1: '陳大明', field_2: '鼎盛科技股份有限公司', field_3: '0912-345-678', field_4: 'dm@ds-tech.com', field_5: 150000, field_6: '已成交' },
          { field_1: '林美玲', field_2: '創新數位行銷', field_3: '0988-765-432', field_4: 'meiling@innovate.tw', field_5: 85000, field_6: '商談中' }
        ]
      },
      finance: {
        dbName: '💰 團隊財務記帳資料庫',
        tableName: '收支紀錄表',
        fields: [
          { name: '收支項目', type: 'text' },
          { name: '類別', type: 'single_select', options: JSON.stringify(['辦公採購', '差旅費', '行銷推廣', '軟體訂閱', '其他']) },
          { name: '金額', type: 'number' },
          { name: '日期', type: 'date' },
          { name: '付款方式', type: 'single_select', options: JSON.stringify(['信用卡', '轉帳', '現金']) }
        ],
        sampleRows: [
          { field_1: '伺服器 AWS 雲端託管費', field_2: '軟體訂閱', field_3: 12500, field_4: '2026-07-15', field_5: '信用卡' },
          { field_1: '團隊年中餐會', field_2: '辦公採購', field_3: 8800, field_4: '2026-07-20', field_5: '轉帳' }
        ]
      },
      hr: {
        dbName: '👥 人事資料通訊錄',
        tableName: '員工名冊',
        fields: [
          { name: '員工姓名', type: 'text' },
          { name: '部門', type: 'single_select', options: JSON.stringify(['研發部', '產品部', '行銷部', '財務部', '人資部']) },
          { name: '職稱', type: 'text' },
          { name: '入職日期', type: 'date' },
          { name: '聯絡電話', type: 'text' }
        ],
        sampleRows: [
          { field_1: '張家豪', field_2: '研發部', field_3: '資深軟體工程師', field_4: '2024-03-01', field_5: '0911-111-222' },
          { field_1: '黃雅婷', field_2: '產品部', field_3: '產品經理 (PM)', field_4: '2025-01-15', field_5: '0922-333-444' }
        ]
      }
    }

    const config = templateMap[templateKey]
    if (!config) return

    try {
      // 1. Create database
      const dbRes = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_database',
          workspaceId: activeWorkspaceObj.id,
          name: config.dbName
        })
      })
      const newDb = await dbRes.json()
      if (!dbRes.ok || !newDb.id) {
        uiActions.addToast(newDb.error || '建立資料庫失敗', 'error')
        return
      }

      // 2. Create table in the new db
      const tableRes = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_table',
          databaseId: newDb.id,
          name: config.tableName
        })
      })
      const newTable = await tableRes.json()
      if (!tableRes.ok || !newTable.id) {
        uiActions.addToast(newTable.error || '建立資料表失敗', 'error')
        return
      }

      // 3. Add fields
      for (let i = 0; i < config.fields.length; i++) {
        const f = config.fields[i]
        await fetch(`/api/tables/${newTable.id}/fields`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: f.name,
            type: f.type,
            options: f.options || null
          })
        })
      }

      // 4. Fetch updated fields for key mapping
      const fieldsRes = await fetch(`/api/tables/${newTable.id}/fields`)
      const updatedFields = await fieldsRes.json()

      // 5. Add sample rows
      if (Array.isArray(updatedFields) && updatedFields.length > 0) {
        for (const sample of config.sampleRows) {
          const rowData: Record<string, any> = {}
          const sampleValues = Object.values(sample)
          updatedFields.forEach((fieldItem: TableField, idx: number) => {
            if (sampleValues[idx] !== undefined) {
              rowData[`field_${fieldItem.id}`] = sampleValues[idx]
            }
          })
          await fetch(`/api/tables/${newTable.id}/rows`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: rowData })
          })
        }
      }

      uiActions.addToast(`已成功從範本建立「${config.dbName}」！`, 'success')
      await wsActions.fetchWorkspaces()
      wsActions.setActiveTableId(newTable.id)
    } catch {
      uiActions.addToast('從範本建立失敗', 'error')
    }
  }

  return (
    <div className={`app-container theme-${themeState.theme}`}>
      <FYCDBrandLoading
        show={showBrandLoading}
        workspaceReady={workspaceReady}
        onExitComplete={handleExitComplete}
      />
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
              backgroundColor: toast.type === 'error' ? '#dc2626' : toast.type === 'success' ? '#16a34a' : '#3F6212',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.25)'
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>

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
          ) : (
            <>
              {/* View selector and header toolbar */}
              <ViewToolbar
                canManageStructure={currentUserRolePermissions.canManageStructure}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                views={views}
                activeViewId={wsState.activeViewId}
                setActiveViewId={(id) => {
                  wsActions.setActiveViewId(id)
                  if (typeof window !== 'undefined' && wsState.activeTableId) {
                    localStorage.setItem(`activeViewId_${wsState.activeTableId}`, String(id))
                  }
                }}
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
                sortRules={sortRules}
                setSortRules={(rules) => {
                  setSortRules(rules)
                  const primaryKey = rules.length > 0 ? rules[0].fieldKey : null
                  const primaryOrder = rules.length > 0 ? rules[0].order : 'asc'
                  setSortField(primaryKey)
                  setSortOrder(primaryOrder)
                  if (wsState.activeViewId) {
                    saveViewConfig(wsState.activeViewId, {
                      sortField: primaryKey,
                      sortOrder: primaryOrder,
                      sortRules: rules,
                    })
                  }
                }}
                filterRules={filterRules}
                setFilterRules={(rules) => {
                  setFilterRules(rules)
                  if (wsState.activeViewId) {
                    saveViewConfig(wsState.activeViewId, {
                      filters: JSON.stringify({ filterType, rules }),
                      filterType,
                    })
                  }
                }}
                filterType={filterType}
                setFilterType={(type) => {
                  setFilterType(type)
                  if (wsState.activeViewId) {
                    saveViewConfig(wsState.activeViewId, {
                      filters: JSON.stringify({ filterType: type, rules: filterRules }),
                      filterType: type,
                    })
                  }
                }}
                rowColorRules={Array.isArray(rowColorRules) ? rowColorRules : []}
                setRowColorRules={(rules) => {
                  setRowColorRules(rules)
                  if (wsState.activeViewId) {
                    saveViewConfig(wsState.activeViewId, { rowColors: JSON.stringify(rules) })
                  }
                }}
                groupByField={groupByField}
                setGroupByField={setGroupByField}
                groupByRules={groupByRules}
                setGroupByRules={(rules) => {
                  setGroupByRules(rules)
                  const primaryKey = rules.length > 0 ? rules[0].fieldKey : null
                  setGroupByField(primaryKey)
                  setGroupCollapseState({ mode: 'expand', exceptions: {} })
                  if (wsState.activeViewId) {
                    saveViewConfig(wsState.activeViewId, {
                      groupByField: rules.length > 0 ? JSON.stringify(rules) : null,
                      groupByRules: rules,
                    })
                  }
                }}
                onToggleCollapseAllGroups={(collapse) => {
                  setGroupCollapseState({
                    mode: collapse ? 'collapse' : 'expand',
                    exceptions: {},
                  })
                }}
                fields={fields}
                hiddenFieldKeys={hiddenFieldKeys}
                setHiddenFieldKeys={setHiddenFieldKeys}
                rowHeightSize={rowHeightSize}
                setRowHeightSize={setRowHeightSize}
                handleExportCSV={handleExportCSV}
                handleCSVImport={handleCSVImport}
                csvInputRef={csvInputRef}
                onImportAirtable={() => setShowAirtableModal(true)}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={() => undo(wsState.activeTableId)}
                onRedo={() => redo(wsState.activeTableId)}
              />

              {/* View content */}
              <PullToRefresh
                onRefresh={async () => {
                  if (typeof window !== 'undefined') {
                    uiActions.addToast('正在重新載入全網頁與最新版本...', 'info')
                    window.location.reload()
                  }
                }}
              >
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
                    readOnly={!authState.currentUser || !currentUserRolePermissions.canEditData}
                    isOffline={isOffline}
                    frozenColumnsCount={frozenColumnsCount}
                    columnWidths={columnWidths}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    sortRules={sortRules}
                    groupByField={groupByField}
                    groupByRules={groupByRules}
                    groupCollapseState={groupCollapseState}
                    onUpdateGroupCollapseState={setGroupCollapseState}
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
                    batchUpdateCells={batchUpdateCells}
                    toggleSort={toggleSort}
                    setEditingFieldId={setEditingFieldId}
                    setEditingFieldName={setEditingFieldName}
                    handleColumnDragStart={handleColumnDragStart}
                    handleColumnDragOver={handleColumnDragOver}
                    handleColumnDrop={handleColumnDrop}
                    setColumnWidths={setColumnWidths}
                    activeTableId={wsState.activeTableId}
                    activeViewId={wsState.activeViewId}
                    views={views}
                    updateViewConfig={saveViewConfig}
                    setContextMenu={setContextMenu}
                    setSelectedRow={setSelectedRow}
                    setShowDetailModal={setShowDetailModal}
                    duplicateRow={duplicateRow}
                    deleteRow={deleteRow}
                    addRow={addRow}
                    batchAddRows={batchAddRows}
                    setShowNewFieldModal={setShowNewFieldModal}
                    onAddFieldPopover={(pos) => {
                      setNewFieldPopoverPos(pos)
                      setShowNewFieldModal(true)
                    }}
                    handleUpdateField={handleUpdateField}
                    setFieldContextMenu={setFieldContextMenu}
                    onUndo={undo}
                    onRedo={redo}
                    onReorderRows={handleReorderRows}
                    batchMoveRows={batchMoveRows}
                    stageMoveRows={stageMoveRows}
                    cancelMoveRows={cancelMoveRows}
                  />
                </div>
              </PullToRefresh>
            </>
          )}

          {/* Mobile Bottom Navigation Bar (Inside layout__col-2) */}
          <MobileBottomNav
            workspaces={wsState.workspaces}
            activeWorkspaceId={wsState.activeWorkspaceId}
            activeTableId={wsState.activeTableId}
            currentUser={authState.currentUser}
            notificationCount={unreadNotificationsCount}
            fields={fields}
            rows={rows}
            onSelectDashboard={() => {
              wsActions.setActiveTableId(0)
            }}
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
        newFieldPopoverPos={newFieldPopoverPos}
        setNewFieldPopoverPos={setNewFieldPopoverPos}
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
        setGroupByField={(field) => {
          setGroupByField(field)
          if (wsState.activeViewId) {
            saveViewConfig(wsState.activeViewId, { groupByField: field })
          }
        }}
        deleteField={deleteField}
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
  )
}
