'use client'

import { useState, useCallback } from 'react'
import * as viewService from '@/modules/database/services/view'
import type {
  TableView,
  ViewType,
  FilterRule,
  RowColorRule,
  GroupByRule,
  SortRule,
  ViewConfigPatch,
} from '@/modules/database/types'

interface UseViewConfigParams {
  activeTableId: number | null
  activeViewId: number | null
  setActiveViewId: (id: number) => void
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useViewConfig({ activeTableId, activeViewId, setActiveViewId, addToast }: UseViewConfigParams) {
  // View state
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

  // Apply a view's persisted config to local state
  const applyViewConfig = useCallback((view: TableView) => {
    setCurrentView(view.type)

    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const safeParse = (val: unknown, fallback: any): any => {
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

  // Save view config changes to the backend
  const saveViewConfig = useCallback(async (updatedViewId: number, changes: ViewConfigPatch) => {
    if (!activeTableId) return
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
      setViews(prev => prev.map(v => v.id === updatedViewId ? { ...v, ...(serializedChanges as Partial<TableView>) } : v))

      await viewService.updateViewConfig(activeTableId, updatedViewId, serializedChanges)
    } catch { }
  }, [activeTableId])

  // Toggle sort on a field
  const toggleSort = useCallback((fieldKey: string) => {
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

    if (activeViewId) {
      saveViewConfig(activeViewId, { sortField: nextField, sortOrder: nextOrder })
    }
  }, [sortField, sortOrder, activeViewId, saveViewConfig])

  // Toggle field visibility
  const toggleFieldVisibility = useCallback((fieldKey: string) => {
    let nextHidden: string[]
    if (hiddenFieldKeys.includes(fieldKey)) {
      nextHidden = hiddenFieldKeys.filter(k => k !== fieldKey)
    } else {
      nextHidden = [...hiddenFieldKeys, fieldKey]
    }
    setHiddenFieldKeys(nextHidden)
    if (activeViewId) {
      saveViewConfig(activeViewId, { hiddenFields: nextHidden })
    }
  }, [hiddenFieldKeys, activeViewId, saveViewConfig])

  // Create a new view
  const createView = useCallback(async (name: string, type: ViewType) => {
    if (!name.trim() || !activeTableId) return
    try {
      const result = await viewService.createView(activeTableId, name.trim(), type)
      if (result.ok && result.view) {
        setViews(prev => [...prev, result.view!])
        setActiveViewId(result.view!.id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${activeTableId}`, String(result.view!.id))
        }
        applyViewConfig(result.view!)
        setShowNewViewModal(false)
        setNewViewName('')
        addToast(`視圖「${result.view!.name}」已建立`, 'success')
      } else {
        addToast(result.error || '建立視圖失敗', 'error')
      }
    } catch {
      addToast('建立視圖失敗', 'error')
    }
  }, [activeTableId, setActiveViewId, applyViewConfig, addToast])

  // Delete the currently active view
  const deleteView = useCallback(async () => {
    if (!activeViewId || !activeTableId) return
    const activeView = views.find(v => v.id === activeViewId)
    if (!activeView) return

    if (!confirm(`確定要刪除視圖「${activeView.name}」？`)) return

    try {
      await viewService.deleteView(activeTableId, activeViewId)
      const remaining = views.filter(v => v.id !== activeViewId)
      setViews(remaining)
      if (remaining.length > 0) {
        setActiveViewId(remaining[0].id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${activeTableId}`, String(remaining[0].id))
        }
        applyViewConfig(remaining[0])
      }
      addToast('視圖已刪除', 'success')
    } catch {
      addToast('刪除視圖失敗', 'error')
    }
  }, [activeViewId, activeTableId, views, setActiveViewId, applyViewConfig, addToast])

  // Duplicate a view
  const handleDuplicateView = useCallback(async (targetViewId: number) => {
    const sourceView = views.find(v => v.id === targetViewId)
    if (!sourceView || !activeTableId) return
    const duplicateName = `${sourceView.name} (Copy)`
    try {
      const result = await viewService.createView(activeTableId, duplicateName, sourceView.type || 'grid')
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
        setActiveViewId(result.view.id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${activeTableId}`, String(result.view.id))
        }
        applyViewConfig(fullView)
        addToast(`已成功複製視圖「${duplicateName}」`, 'success')
      } else {
        addToast(result.error || '複製視圖失敗', 'error')
      }
    } catch {
      addToast('複製視圖失敗', 'error')
    }
  }, [views, activeTableId, saveViewConfig, setActiveViewId, applyViewConfig, addToast])

  // Delete a specific view by id
  const handleDeleteViewById = useCallback(async (targetViewId: number) => {
    if (!activeTableId) return
    const targetView = views.find(v => v.id === targetViewId)
    if (!targetView) return
    if (!confirm(`確定要刪除視圖「${targetView.name}」？`)) return
    try {
      await viewService.deleteView(activeTableId, targetViewId)
      const remaining = views.filter(v => v.id !== targetViewId)
      setViews(remaining)
      if (remaining.length > 0 && activeViewId === targetViewId) {
        setActiveViewId(remaining[0].id)
        if (typeof window !== 'undefined') {
          localStorage.setItem(`activeViewId_${activeTableId}`, String(remaining[0].id))
        }
        applyViewConfig(remaining[0])
      }
      addToast('視圖已刪除', 'success')
    } catch {
      addToast('刪除視圖失敗', 'error')
    }
  }, [activeTableId, views, activeViewId, setActiveViewId, applyViewConfig, addToast])

  // Rename a view
  const handleRenameViewById = useCallback(async (targetViewId: number) => {
    const targetView = views.find(v => v.id === targetViewId)
    if (!targetView || !activeTableId) return
    const newName = prompt('請輸入新的視圖名稱：', targetView.name)
    if (newName && newName.trim() && newName.trim() !== targetView.name) {
      try {
        await viewService.updateViewConfig(activeTableId, targetViewId, { name: newName.trim() } as Partial<TableView> as ViewConfigPatch)
        setViews(prev => prev.map(v => v.id === targetViewId ? { ...v, name: newName.trim() } : v))
        addToast('視圖名稱已更新', 'success')
      } catch {
        addToast('更新視圖名稱失敗', 'error')
      }
    }
  }, [views, activeTableId, addToast])

  // Reset view state when switching tables (no views found)
  const resetViewState = useCallback(() => {
    setViews([])
    setCurrentView('grid')
    setFilterRules([])
    setHiddenFieldKeys([])
    setRowColorRules([])
    setColumnWidths({})
    setSortField(null)
    setSortOrder('asc')
    setGroupByField(null)
  }, [])

  return {
    // State
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
    // Functions
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
  }
}
