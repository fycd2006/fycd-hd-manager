import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Layers,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Edit3,
  Loader2,
  Table as TableIcon,
  Sparkles,
  Info,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  Plus,
  Trash2,
  X,
  Columns,
  Eye,
  EyeOff,
  Hash,
  Type,
  CheckCircle2,
  Calendar,
  ToggleLeft,
  Link2,
  Download,
  Pin,
  PinOff,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  HelpCircle,
  Check,
  Split,
  Zap,
  Target,
  ChevronDown,
  ChevronRight,
  Star,
  Mail,
  Clock,
  MessageSquare,
  Paperclip,
  User,
  ListFilter,
} from 'lucide-react'
import { CardDrawer } from '@/modules/database/components/cards/CardDrawer'
import { WorkspaceGridSkeleton } from '@/modules/database/components/table/WorkspaceGridSkeleton'
import { formatDateValue } from '@/modules/database/utils'
import {
  parseSelectItems,
  getOptionColor,
  formatNumberValue,
} from '@/modules/database/components/views/grid/cells/utils'
import { renderFormulaCell } from '@/modules/database/components/views/grid/cells/FormulaCell'
import { parseLatestCommentEntries } from '@/modules/database/components/views/grid/GridViewCell'

import { FieldMappingModal } from './FieldMappingModal'
import { MasterGridCell } from './MasterGridCell'
import type { MasterViewRowWithOverrides } from '@/modules/database/services/masterViewOverride'
import {
  type CrossTableFilterRule,
  type MasterFieldInfo,
  type UnifiedColumnInfo,
  computeColumnSummary,
  analyzeFieldFrequencies,
  buildUnifiedColumns,
  getRowFieldValue,
  mergeFieldOptions,
  extractChoicesList,
} from '@/modules/database/services/multiTableUtils'

export type { MasterFieldInfo }

export interface MasterGridViewProps {
  workspaceId: number
  masterViewId?: number
  workspaceName?: string
  tablesMap?: Record<number, { name: string; color?: string }>
  readOnly?: boolean
}

export const MasterGridView: React.FC<MasterGridViewProps> = ({
  workspaceId,
  masterViewId,
  workspaceName,
  tablesMap = {},
  readOnly = false,
}) => {
  const [rows, setRows] = useState<MasterViewRowWithOverrides[]>([])
  const [fieldsMap, setFieldsMap] = useState<Record<string, MasterFieldInfo>>({})
  const [permissionInfo, setPermissionInfo] = useState<{
    totalTablesCount: number
    authorizedTablesCount: number
    hiddenTablesCount: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<CrossTableFilterRule[]>([])
  const [showFilterBar, setShowFilterBar] = useState(false)

  const masterStorageKey = useMemo(() => {
    if (workspaceId && masterViewId) return `master_agg_modes_${workspaceId}_${masterViewId}`;
    if (workspaceId) return `master_agg_modes_${workspaceId}`;
    return null;
  }, [workspaceId, masterViewId]);

  const [aggregationModes, setAggregationModes] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined' && masterStorageKey) {
      try {
        const saved = localStorage.getItem(masterStorageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse master aggregation modes', e);
      }
    }
    return {};
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && masterStorageKey) {
      try {
        const saved = localStorage.getItem(masterStorageKey);
        if (saved) {
          setAggregationModes(JSON.parse(saved));
        } else {
          setAggregationModes({});
        }
      } catch (e) {
        console.error('Failed to load master aggregation modes', e);
      }
    }
  }, [masterStorageKey]);

  const handleUpdateMasterAggregationMode = useCallback((key: string, newMode: string) => {
    setAggregationModes((prev) => {
      const next = { ...prev, [key]: newMode };
      if (typeof window !== 'undefined' && masterStorageKey) {
        try {
          localStorage.setItem(masterStorageKey, JSON.stringify(next));
        } catch (e) {
          console.error('Failed to save master aggregation modes', e);
        }
      }
      return next;
    });
  }, [masterStorageKey]);

  const [customVisibleKeys, setCustomVisibleKeys] = useState<string[] | null>(null)
  const [showColumnsBar, setShowColumnsBar] = useState(false)
  const [showFieldMappingModal, setShowFieldMappingModal] = useState(false)
  const [maxColumnsLimit] = useState(15)
  const [selectedTableIds, setSelectedTableIds] = useState<number[]>([])
  const [columnFilterQuery, setColumnFilterQuery] = useState('')
  const [smartPrune, setSmartPrune] = useState(true)
  const [serverTableCounts, setServerTableCounts] = useState<Record<number, number>>({})
  const [totalRowsCount, setTotalRowsCount] = useState<number | null>(null)
  const [fieldFilterTab, setFieldFilterTab] = useState<'all' | 'shared' | 'specific' | 'filled'>('all')
  const [collapsedTableGroups, setCollapsedTableGroups] = useState<Set<number>>(new Set())
  const [groupByTable, setGroupByTable] = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const handleToggleCollapseGroup = useCallback((tid: number) => {
    setCollapsedTableGroups((prev) => {
      const next = new Set(prev)
      if (next.has(tid)) {
        next.delete(tid)
      } else {
        next.add(tid)
      }
      return next
    })
  }, [])

  // Multi-select state
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set())

  const toggleSelectRow = useCallback((tableId: number, rowId: number) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      const k = `${tableId}_${rowId}`
      if (next.has(k)) {
        next.delete(k)
      } else {
        next.add(k)
      }
      return next
    })
  }, [])

  // Pinning & Unmerging states
  const [pinnedKeys, setPinnedKeys] = useState<string[]>([])
  const [unmergedKeys, setUnmergedKeys] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`master_unmerged_keys_${workspaceId}`)
        return stored ? JSON.parse(stored) : []
      } catch { }
    }
    return []
  })

  const [customAliasMap, setCustomAliasMap] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`master_alias_map_${workspaceId}`)
        return stored ? JSON.parse(stored) : {}
      } catch { }
    }
    return {}
  })
  const [activeColumnPopover, setActiveColumnPopover] = useState<string | null>(null)
  const [activeOverridePopover, setActiveOverridePopover] = useState<{
    tableId: number
    rowId: number
    key: string
  } | null>(null)
  const [activeExcludedMismatchPopover, setActiveExcludedMismatchPopover] = useState<string | null>(null)
  const [revertingOverride, setRevertingOverride] = useState(false)

  // Drawer state
  const [selectedDrawerRow, setSelectedDrawerRow] = useState<{
    tableId: number
    rowId: number
    tableName?: string
  } | null>(null)

  // Build unified column definitions from fieldsMap with unmerge and custom alias support
  const unifiedColumns = useMemo(
    () => buildUnifiedColumns(fieldsMap, unmergedKeys, tablesMap, customAliasMap),
    [fieldsMap, unmergedKeys, tablesMap, customAliasMap]
  )


  const unifiedColumnsMap = useMemo(() => {
    const map: Record<string, UnifiedColumnInfo> = {}
    unifiedColumns.forEach((c) => {
      map[c.key] = c
    })
    return map
  }, [unifiedColumns])

  // Helper to get human-readable field label
  const getFieldLabel = useCallback(
    (key: string): string => {
      if (unifiedColumnsMap[key]?.name) return unifiedColumnsMap[key].name
      const info = fieldsMap[key]
      if (info?.name) return info.name
      if (key === 'createdAt') return '建立時間'
      if (key === 'id') return 'ID'
      if (key === 'tableId') return '資料表 ID'
      return key
    },
    [fieldsMap, unifiedColumnsMap]
  )

  // Helper to get field type icon
  const getFieldTypeIcon = (type?: string) => {
    switch (type) {
      case 'number':
        return <Hash size={12} color="#0284c7" />
      case 'single_select':
        return <CheckCircle2 size={12} color="#16a34a" />
      case 'multiple_select':
        return <ListFilter size={12} color="#16a34a" />
      case 'boolean':
        return <ToggleLeft size={12} color="#7c3aed" />
      case 'date':
      case 'created_on':
      case 'last_modified_on':
        return <Calendar size={12} color="#ea580c" />
      case 'link_row':
        return <Link2 size={12} color="#4f46e5" />
      case 'rating':
        return <Star size={12} color="#f59e0b" />
      case 'email':
        return <Mail size={12} color="#ea580c" />
      case 'url':
        return <Link2 size={12} color="#ea580c" />
      case 'latest_comment':
        return <MessageSquare size={12} color="#ea580c" />
      case 'file':
      case 'attachment':
        return <Paperclip size={12} color="#64748b" />
      case 'collaborator':
      case 'created_by':
      case 'last_modified_by':
        return <User size={12} color="#7c3aed" />
      case 'formula':
      case 'rollup':
      case 'lookup':
        return <Sparkles size={12} color="#64748b" />
      case 'duration':
        return <Clock size={12} color="#ea580c" />
      default:
        return <Type size={12} color="#64748b" />
    }
  }

  // Dynamic pinned column sticky left offset calculation (avoids fixed width assumptions)
  const getPinnedStickyLeft = useCallback(
    (key: string): string => {
      const pinnedIndex = pinnedKeys.indexOf(key)
      if (pinnedIndex === -1) return '0px'
      // Base offset: index (#) = 60px, source table badge = 160px => 220px
      const baseOffset = 220
      return `${baseOffset + pinnedIndex * 160}px`
    },
    [pinnedKeys]
  )

  // Global keyboard shortcuts for fast navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setActiveColumnPopover(null)
        setActiveOverridePopover(null)
        setActiveExcludedMismatchPopover(null)
        setShowColumnsBar(false)
        setShowFilterBar(false)
        setShowFieldMappingModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])


  // Toggle sort on column header
  const handleToggleSort = (fieldKey: string) => {
    if (sortField !== fieldKey) {
      setSortField(fieldKey)
      setSortOrder('asc')
    } else if (sortOrder === 'asc') {
      setSortOrder('desc')
    } else {
      setSortField(null)
      setSortOrder('desc')
    }
  }

  // Pin / Unpin column (session only, not auto-stored)
  const handleTogglePinColumn = (fieldKey: string) => {
    setPinnedKeys((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey]
    )
  }


  // Unmerge / Merge column
  const handleToggleUnmergeColumn = (fieldKey: string) => {
    setUnmergedKeys((prev) => {
      const next = prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey]
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`master_unmerged_keys_${workspaceId}`, JSON.stringify(next))
        } catch { }
      }
      return next
    })
    setActiveColumnPopover(null)
  }

  // Revert override handler
  const handleRevertOverride = async (tableId: number, rowId: number, fieldKey: string) => {
    if (!masterViewId) return
    setRevertingOverride(true)
    try {
      const tableFieldKey = unifiedColumnsMap[fieldKey]?.tableFieldMap[tableId] || fieldKey
      const res = await fetch(`/api/workspaces/${workspaceId}/master-views/${masterViewId}/rows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: tableId,
          sourceRowId: rowId,
          fieldKey: tableFieldKey,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '還原覆寫欄位失敗')
      }

      // Optimistically update local rows
      setRows((prev) =>
        prev.map((r) => {
          if (r.tableId === tableId && r.id === rowId) {
            const originalVal = getRowFieldValue(
              { tableId: r.tableId, data: r._originalData },
              fieldKey,
              unifiedColumnsMap,
              fieldsMap
            )
            const updatedData = { ...r.data }
            if (originalVal !== undefined) {
              updatedData[fieldKey] = originalVal
              updatedData[tableFieldKey] = originalVal
            } else {
              delete updatedData[fieldKey]
              delete updatedData[tableFieldKey]
            }

            const updatedOverrideKeys = (r._overrideKeys || []).filter(
              (k) => k !== fieldKey && k !== tableFieldKey
            )
            return {
              ...r,
              data: updatedData,
              _overrideKeys: updatedOverrideKeys,
              _hasOverride: updatedOverrideKeys.length > 0,
            }
          }
          return r
        })
      )
      setActiveOverridePopover(null)
    } catch (err: any) {
      alert(err.message || '還原覆寫欄位失敗')
    } finally {
      setRevertingOverride(false)
    }
  }

  // Filter handlers
  const handleAddFilter = () => {
    const defaultField = allFieldKeys[0] || 'createdAt'
    setFilters((prev) => [...prev, { field: defaultField, operator: 'contains', value: '' }])
  }

  const handleUpdateFilter = (index: number, updates: Partial<CrossTableFilterRule>) => {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  const handleRemoveFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClearFilters = () => {
    setFilters([])
  }

  // Fetch initial rows
  const fetchRows = useCallback(
    async (cursor?: string | null) => {
      if (!workspaceId) return

      try {
        if (!cursor) setLoading(true)
        else setLoadingMore(true)
        setError(null)

        let url = `/api/workspaces/${workspaceId}/all-rows?limit=50`
        if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`
        if (masterViewId) url += `&masterViewId=${encodeURIComponent(String(masterViewId))}`
        if (sortField) {
          url += `&sortField=${encodeURIComponent(sortField)}&sortOrder=${encodeURIComponent(sortOrder)}`
        }
        if (filters.length > 0) {
          url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`
        }
        if (selectedTableIds.length > 0) {
          url += `&tableIds=${encodeURIComponent(selectedTableIds.join(','))}`
        }
        if (Object.keys(customAliasMap).length > 0) {
          url += `&aliasMap=${encodeURIComponent(JSON.stringify(customAliasMap))}`
        }

        const res = await fetch(url)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || '載入跨表資料失敗')
        }

        const data = await res.json()
        if (cursor) {
          setRows((prev) => [...prev, ...(data.rows || [])])
        } else {
          setRows(data.rows || [])
        }
        if (data.fieldsMap) {
          setFieldsMap((prev) => ({ ...prev, ...data.fieldsMap }))
        }
        if (data.permissionInfo) {
          setPermissionInfo(data.permissionInfo)
        }
        if (data.tableCounts) {
          setServerTableCounts(data.tableCounts)
        }
        if (typeof data.totalRowsCount === 'number') {
          setTotalRowsCount(data.totalRowsCount)
        }
        setNextCursor(data.nextCursor || null)
      } catch (err: any) {
        setError(err.message || '無法取得跨表資料')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [workspaceId, masterViewId, sortField, sortOrder, filters, selectedTableIds, customAliasMap]
  )

  useEffect(() => {
    fetchRows(null)
  }, [fetchRows])

  // Global Keyboard Shortcuts (/ to search, Escape to close panels)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        const target = e.target as HTMLElement | null
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        if (!isInput) {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
      } else if (e.key === 'Escape') {
        setShowColumnsBar(false)
        setShowFilterBar(false)
        setActiveColumnPopover(null)
        setActiveOverridePopover(null)
        setActiveExcludedMismatchPopover(null)
        setShowFieldMappingModal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Analyze field frequencies and determine sparse vs default visible columns using unified columns and pinned keys
  const frequencyAnalysis = useMemo(
    () => analyzeFieldFrequencies(rows, maxColumnsLimit, fieldsMap, pinnedKeys, unmergedKeys, customAliasMap),
    [rows, maxColumnsLimit, fieldsMap, pinnedKeys, unmergedKeys, customAliasMap]
  )

  const allFieldKeys = useMemo(
    () => frequencyAnalysis.allFields.map((f) => f.key),
    [frequencyAnalysis.allFields]
  )

  const visibleFieldKeys = useMemo(() => {
    let rawKeys = customVisibleKeys ?? frequencyAnalysis.defaultVisibleKeys

    // If smartPrune is enabled and specific tables are selected, prune fields that have no active sources
    if (smartPrune && selectedTableIds.length > 0) {
      rawKeys = rawKeys.filter((key) => {
        const col = unifiedColumnsMap[key]
        if (!col) return true
        const sourceTableIds = col.sources?.map((s) => s.tableId) || (fieldsMap[key] ? [fieldsMap[key].tableId] : [])
        return sourceTableIds.some((tid) => selectedTableIds.includes(tid))
      })
    }

    const pinned = rawKeys.filter((k) => pinnedKeys.includes(k))
    const unpinned = rawKeys.filter((k) => !pinnedKeys.includes(k))
    return [...pinned, ...unpinned]
  }, [customVisibleKeys, frequencyAnalysis.defaultVisibleKeys, pinnedKeys, smartPrune, selectedTableIds, unifiedColumnsMap, fieldsMap])

  // Contextual grouping of all fields into Shared, Table-Specific, and Inactive groups
  const contextualFieldGroups = useMemo(() => {
    const activeTableIds = selectedTableIds.length > 0
      ? selectedTableIds
      : Object.keys(tablesMap).map(Number)

    const sharedFields: typeof frequencyAnalysis.allFields = []
    const tableSpecificFields: Record<number, typeof frequencyAnalysis.allFields> = {}
    const inactiveFields: typeof frequencyAnalysis.allFields = []

    frequencyAnalysis.allFields.forEach((field) => {
      const col = unifiedColumnsMap[field.key]
      const sourceTableIds = col?.sources?.map((s) => s.tableId) || (fieldsMap[field.key] ? [fieldsMap[field.key].tableId] : [])

      const activeSources = sourceTableIds.filter((tid) => activeTableIds.includes(tid))

      if (activeSources.length === 0) {
        inactiveFields.push(field)
      } else if (activeSources.length > 1) {
        sharedFields.push(field)
      } else {
        const tid = activeSources[0]
        if (!tableSpecificFields[tid]) {
          tableSpecificFields[tid] = []
        }
        tableSpecificFields[tid].push(field)
      }
    })

    return { sharedFields, tableSpecificFields, inactiveFields }
  }, [selectedTableIds, tablesMap, frequencyAnalysis.allFields, unifiedColumnsMap, fieldsMap])

  const handleToggleColumnVisibility = (fieldKey: string) => {
    const current = customVisibleKeys ?? frequencyAnalysis.defaultVisibleKeys
    if (current.includes(fieldKey)) {
      setCustomVisibleKeys(current.filter((k) => k !== fieldKey))
    } else {
      setCustomVisibleKeys([...current, fieldKey])
    }
  }

  const handleResetToDefaultColumns = () => {
    setCustomVisibleKeys(null)
  }

  const handleSelectAllColumns = () => {
    setCustomVisibleKeys(allFieldKeys)
  }

  const handleClearAllColumns = () => {
    setCustomVisibleKeys([])
  }

  // Quick action: Toggle all shared / cross-table fields
  const handleToggleSharedFields = (select: boolean) => {
    const targetKeys = contextualFieldGroups.sharedFields.map((f) => f.key)
    const current = customVisibleKeys ?? frequencyAnalysis.defaultVisibleKeys
    if (select) {
      const next = Array.from(new Set([...current, ...targetKeys]))
      setCustomVisibleKeys(next)
    } else {
      const next = current.filter((k) => !targetKeys.includes(k))
      setCustomVisibleKeys(next)
    }
  }

  // Quick action: Focus on a single table
  const handleFocusTable = (tid: number) => {
    setSelectedTableIds([tid])
  }

  // Quick action: Toggle all fields belonging to a specific table
  const handleToggleTableFields = (tid: number, select: boolean) => {
    const targetFields = frequencyAnalysis.allFields.filter((f) => {
      const col = unifiedColumnsMap[f.key]
      const sourceTableIds = col?.sources?.map((s) => s.tableId) || (fieldsMap[f.key] ? [fieldsMap[f.key].tableId] : [])
      return sourceTableIds.includes(tid)
    }).map((f) => f.key)

    const current = customVisibleKeys ?? frequencyAnalysis.defaultVisibleKeys
    if (select) {
      const next = Array.from(new Set([...current, ...targetFields]))
      setCustomVisibleKeys(next)
    } else {
      const next = current.filter((k) => !targetFields.includes(k))
      setCustomVisibleKeys(next)
    }
  }

  const handleApplyMapping = (newUnmergedKeys: string[], newCustomAliasMap: Record<string, string>) => {
    setUnmergedKeys(newUnmergedKeys)
    setCustomAliasMap(newCustomAliasMap)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`master_alias_map_${workspaceId}`, JSON.stringify(newCustomAliasMap))
        localStorage.setItem(`master_unmerged_keys_${workspaceId}`, JSON.stringify(newUnmergedKeys))
      } catch { }
    }
    fetchRows(null)
  }


  // Count rows per source table
  const tableCounts = useMemo(() => {
    if (Object.keys(serverTableCounts).length > 0) {
      return serverTableCounts
    }
    const counts: Record<number, number> = {}
    rows.forEach((r) => {
      counts[r.tableId] = (counts[r.tableId] || 0) + 1
    })
    return counts
  }, [serverTableCounts, rows])


  // Filtered rows (respects search query and selected source table filter chips)
  const filteredRows = useMemo(() => {
    let result = rows

    if (selectedTableIds.length > 0) {
      result = result.filter((r) => selectedTableIds.includes(r.tableId))
    }

    if (!searchQuery.trim()) return result
    const q = searchQuery.toLowerCase().trim()

    return result.filter((r) => {
      const tableName = tablesMap[r.tableId]?.name || `Table ${r.tableId}`
      if (tableName.toLowerCase().includes(q)) return true
      if (String(r.id).includes(q)) return true

      return allFieldKeys.some((k) => {
        const val = getRowFieldValue(r, k, unifiedColumnsMap, fieldsMap)
        if (val == null) return false

        // Handle arrays (e.g. link rows, multiple select, multiple collaborators)
        if (Array.isArray(val)) {
          return val.some((item) => {
            if (item == null) return false
            if (typeof item === 'object') {
              return Object.values(item).some(
                (v) => v != null && String(v).toLowerCase().includes(q)
              )
            }
            return String(item).toLowerCase().includes(q)
          })
        }

        // Handle single object (e.g. single link row, collaborator object)
        if (typeof val === 'object') {
          return Object.values(val).some(
            (v) => v != null && String(v).toLowerCase().includes(q)
          )
        }

        return String(val).toLowerCase().includes(q)
      })
    })

  }, [rows, selectedTableIds, searchQuery, tablesMap, allFieldKeys, unifiedColumnsMap, fieldsMap])


  // Selection helpers
  const isAllSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every((r) => selectedRowKeys.has(`${r.tableId}_${r.id}`)),
    [filteredRows, selectedRowKeys]
  )

  const isSomeSelected = useMemo(
    () => filteredRows.some((r) => selectedRowKeys.has(`${r.tableId}_${r.id}`)) && !isAllSelected,
    [filteredRows, selectedRowKeys, isAllSelected]
  )

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedRowKeys(new Set())
    } else {
      setSelectedRowKeys(new Set(filteredRows.map((r) => `${r.tableId}_${r.id}`)))
    }
  }, [isAllSelected, filteredRows])

  // Batch revert overrides handler (single batch HTTP request)
  const handleBatchRevertOverrides = async () => {
    if (!masterViewId || selectedRowKeys.size === 0) return
    try {
      const selectedList = Array.from(selectedRowKeys).map((k) => {
        const [tableId, rowId] = k.split('_').map(Number)
        return { sourceTableId: tableId, sourceRowId: rowId }
      })

      const res = await fetch(`/api/workspaces/${workspaceId}/master-views/${masterViewId}/rows`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedList }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || '批量還原覆寫失敗')
      }

      // Optimistically update local rows
      setRows((prev) =>
        prev.map((r) => {
          const k = `${r.tableId}_${r.id}`
          if (selectedRowKeys.has(k) && r._originalData) {
            return {
              ...r,
              data: { ...r._originalData },
              _hasOverride: false,
              _overrideKeys: [],
            }
          }
          return r
        })
      )
      setSelectedRowKeys(new Set())
    } catch (err) {
      console.error('Failed to batch revert overrides:', err)
    }
  }


  // Export CSV handler (supports selected rows or all filtered rows)
  const handleExportCsv = () => {
    if (filteredRows.length === 0) return
    const rowsToExport = selectedRowKeys.size > 0
      ? filteredRows.filter((r) => selectedRowKeys.has(`${r.tableId}_${r.id}`))
      : filteredRows

    if (rowsToExport.length === 0) return
    const headers = ['#', '來源資料表', ...visibleFieldKeys.map((k) => getFieldLabel(k)), '建立時間']
    const csvRows = rowsToExport.map((r, idx) => {
      const tableName = tablesMap[r.tableId]?.name || `Table ${r.tableId}`
      const values = visibleFieldKeys.map((k) => {
        const val = getRowFieldValue(r, k, unifiedColumnsMap, fieldsMap)
        if (val == null || val === '') return '""'

        const unifiedCol = unifiedColumnsMap[k]
        const tableFieldKey = unifiedCol?.tableFieldMap[r.tableId] || k
        const tableFieldInfo = fieldsMap[tableFieldKey] || fieldsMap[k]
        const sampleFieldInfo = unifiedCol ? fieldsMap[`field_${unifiedCol.sampleFieldId}`] : null
        const fieldType = tableFieldInfo?.type || unifiedCol?.type || sampleFieldInfo?.type || 'text'

        let mergedOptions = mergeFieldOptions(unifiedCol?.options, tableFieldInfo?.options)
        mergedOptions = mergeFieldOptions(mergedOptions, sampleFieldInfo?.options)
        if (unifiedCol?.sources) {
          for (const src of unifiedCol.sources) {
            if (fieldsMap[src.fieldKey]?.options) {
              mergedOptions = mergeFieldOptions(mergedOptions, fieldsMap[src.fieldKey]?.options)
            }
          }
        }

        let textVal = ''
        if (fieldType === 'boolean' || typeof val === 'boolean') {
          textVal = val ? '是' : '否'
        } else if (fieldType === 'single_select' || fieldType === 'multiple_select') {
          const parsed = parseSelectItems(val, mergedOptions)
          const isUuidPattern = (s: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
            /^[0-9a-f]{24,}$/i.test(s.trim())
          textVal = parsed
            .map((itemStr) => {
              let resolved = itemStr
              if (isUuidPattern(itemStr) || /^opt_[a-z0-9]+$/i.test(itemStr)) {
                for (const f of Object.values(fieldsMap)) {
                  const fChoices = extractChoicesList(f.options)
                  const found = fChoices.find(
                    (c: any) =>
                      c &&
                      (String(c.id).toLowerCase() === itemStr.toLowerCase() ||
                        String(c.value).toLowerCase() === itemStr.toLowerCase())
                  )
                  if (found) {
                    const candidate = found.name || found.label || found.text || found.value || ''
                    if (candidate && !isUuidPattern(candidate)) {
                      resolved = candidate
                      break
                    }
                  }
                }
              }
              return isUuidPattern(resolved) ? '' : resolved
            })
            .filter(Boolean)
            .join(', ')
        } else if (fieldType === 'date' || fieldType === 'created_on' || fieldType === 'last_modified_on') {
          textVal = formatDateValue(val)
        } else if (Array.isArray(val)) {
          textVal = val
            .map((item) =>
              typeof item === 'object' && item !== null
                ? item.value || item.name || item.username || item.title || (item.id ? `ID: ${item.id}` : '')
                : String(item)
            )
            .filter(Boolean)
            .join(', ')
        } else if (typeof val === 'object' && val !== null) {
          textVal = val.value || val.name || val.username || val.title || Object.values(val).join(', ')
        } else {
          textVal = String(val)
        }

        return `"${textVal.replace(/"/g, '""')}"`
      })
      return [idx + 1, `"${tableName}"`, ...values, `"${new Date(r.createdAt).toLocaleString()}"`].join(',')
    })

    const csvContent = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...csvRows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `跨表總表匯出_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Callback when a row is updated in the drawer
  const handleRowUpdated = (rowId: number, updatedData: Record<string, any>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id === rowId) {
          return { ...r, data: { ...r.data, ...updatedData } }
        }
        return r
      })
    )
  }

  return (
    <div
      data-testid="master-grid-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#ffffff',
        fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
        overflow: 'hidden',
      }}
    >
      {/* Top Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#fafafa',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: '#f7fee7',
              border: '1px solid #d9f99d',
              color: '#52A628',
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#09090b', letterSpacing: '-0.01em' }}>
                {workspaceName ? `${workspaceName} — 跨表總表` : '跨表總表'}
              </h2>
              {masterViewId && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#f7fee7',
                    border: '1px solid #d9f99d',
                    color: '#52A628',
                  }}
                >
                  <Sparkles size={12} />
                  已啟用總表獨立層
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#71717a' }}>
              彙整工作區內所有資料表的列資料，支援同名欄位自動對齊、動態排序、SQL 篩選與自訂統計。
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              backgroundColor: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: '6px',
              width: '260px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'border-color 0.15s ease',
              position: 'relative',
            }}
          >
            <Search size={14} color="#a1a1aa" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`搜尋已載入資料 (${filteredRows.length}/${rows.length} 筆) (按 / 搜尋)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '12px',
                width: '100%',
                backgroundColor: 'transparent',
                color: '#18181b',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                data-testid="clear-search-btn"
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  padding: '2px',
                  color: '#a1a1aa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
                title="清除搜尋"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Unified View & Columns Hub Button */}
          <button
            onClick={() => setShowColumnsBar((prev) => !prev)}
            data-testid="toggle-columns-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: showColumnsBar || selectedTableIds.length > 0 || Object.keys(customAliasMap).length > 0 ? '#f0fdf4' : '#ffffff',
              border: `1px solid ${showColumnsBar || selectedTableIds.length > 0 || Object.keys(customAliasMap).length > 0 ? '#86efac' : '#e4e4e7'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: showColumnsBar || selectedTableIds.length > 0 || Object.keys(customAliasMap).length > 0 ? '#166534' : '#3f3f46',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={14} color={showColumnsBar || selectedTableIds.length > 0 || Object.keys(customAliasMap).length > 0 ? '#52A628' : '#71717a'} />
            <span>
              檢視與欄位{selectedTableIds.length > 0 ? ` (${selectedTableIds.length}表 · ${visibleFieldKeys.length}欄)` : ` (${visibleFieldKeys.length}/${allFieldKeys.length})`}
            </span>
            {Object.keys(customAliasMap).length > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}
              >
                {Object.keys(customAliasMap).length} 對照
              </span>
            )}
          </button>

          {/* Toggle Filter Bar */}
          <button
            onClick={() => setShowFilterBar((prev) => !prev)}
            data-testid="toggle-filter-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: showFilterBar || filters.length > 0 ? '#f0fdf4' : '#ffffff',
              border: `1px solid ${showFilterBar || filters.length > 0 ? '#86efac' : '#e4e4e7'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: showFilterBar || filters.length > 0 ? '#166534' : '#3f3f46',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            <Filter size={14} color={filters.length > 0 ? '#52A628' : '#71717a'} />
            <span>篩選{filters.length > 0 ? ` (${filters.length})` : ''}</span>
          </button>

          {/* Group By Table Toggle */}
          <button
            onClick={() => setGroupByTable((prev) => !prev)}
            data-testid="toggle-group-by-table-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: groupByTable ? '#f0fdf4' : '#ffffff',
              border: `1px solid ${groupByTable ? '#86efac' : '#e4e4e7'}`,
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: groupByTable ? '#166534' : '#3f3f46',
              cursor: 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s ease',
            }}
            title="依來源資料表進行群組分塊檢視"
          >
            <ListFilter size={14} color={groupByTable ? '#52A628' : '#71717a'} />
            <span>依資料表分組</span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            data-testid="export-csv-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#3f3f46',
              cursor: filteredRows.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={14} color="#71717a" />
            <span>匯出 CSV</span>
          </button>

          <button
            onClick={() => fetchRows(null)}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#3f3f46',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            重新整理
          </button>
        </div>
      </div>


      {/* Permission Notice Banner */}

      {permissionInfo && permissionInfo.hiddenTablesCount > 0 && (
        <div
          data-testid="permission-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 20px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            color: '#1e40af',
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          <ShieldAlert size={15} color="#2563eb" style={{ flexShrink: 0 }} />
          <span>
            此總表共彙整了 <strong>{permissionInfo.totalTablesCount}</strong> 張資料表，您目前有權限檢視其中 <strong>{permissionInfo.authorizedTablesCount}</strong> 張（有 {permissionInfo.hiddenTablesCount} 張資料表因無存取權限已自動遮蔽）。
          </span>
        </div>
      )}

      {/* Sparse Mode Protection Banner */}
      {frequencyAnalysis.sparseKeys.length > 0 && customVisibleKeys === null && (
        <div
          data-testid="sparse-protection-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 20px',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} color="#d97706" />
            <span>
              已啟用稀疏欄位保護：有 <strong>{frequencyAnalysis.sparseKeys.length}</strong> 個低填寫率欄位已自動隱藏以保持檢視流暢。
            </span>
          </div>
          <button
            onClick={() => setCustomVisibleKeys(allFieldKeys)}
            data-testid="show-all-columns-quick-btn"
            style={{
              border: 'none',
              background: 'none',
              color: '#52A628',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            顯示全部 {allFieldKeys.length} 個欄位
          </button>
        </div>
      )}

      {/* Expandable Integrated Dimensions (Tables & Columns) Manager Panel */}
      {showColumnsBar && (() => {
        const filterField = (f: (typeof frequencyAnalysis.allFields)[0]) => {
          if (fieldFilterTab === 'filled' && f.coverageRate === 0) return false
          if (!columnFilterQuery.trim()) return true
          const q = columnFilterQuery.toLowerCase().trim()
          const label = getFieldLabel(f.key).toLowerCase()
          return label.includes(q) || f.key.toLowerCase().includes(q)
        }

        const showShared = fieldFilterTab === 'all' || fieldFilterTab === 'shared' || fieldFilterTab === 'filled'
        const showSpecific = fieldFilterTab === 'all' || fieldFilterTab === 'specific' || fieldFilterTab === 'filled'

        const filteredSharedFields = showShared ? contextualFieldGroups.sharedFields.filter(filterField) : []
        const filteredInactiveFields = showSpecific ? contextualFieldGroups.inactiveFields.filter(filterField) : []
        const filteredTableSpecificFields: Record<number, typeof frequencyAnalysis.allFields> = {}
        if (showSpecific) {
          Object.entries(contextualFieldGroups.tableSpecificFields).forEach(([tidStr, fields]) => {
            const tid = Number(tidStr)
            const matching = fields.filter(filterField)
            if (matching.length > 0) {
              filteredTableSpecificFields[tid] = matching
            }
          })
        }

        const renderFieldPill = (
          fieldInfo: (typeof frequencyAnalysis.allFields)[0],
          isInactive: boolean = false
        ) => {
          const isChecked = visibleFieldKeys.includes(fieldInfo.key)
          const colType = unifiedColumnsMap[fieldInfo.key]?.type || fieldsMap[fieldInfo.key]?.type
          const unifiedCol = unifiedColumnsMap[fieldInfo.key]
          const isUnmerged = unmergedKeys.includes(fieldInfo.key)
          const isAliased = customAliasMap[fieldInfo.key] !== undefined
          const sources = unifiedCol?.sources || (fieldsMap[fieldInfo.key] ? [{ tableId: fieldsMap[fieldInfo.key].tableId, tableName: tablesMap[fieldsMap[fieldInfo.key].tableId]?.name || '' }] : [])

          return (
            <div
              key={fieldInfo.key}
              data-testid={`column-toggle-${fieldInfo.key}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 9px',
                borderRadius: '6px',
                backgroundColor: isChecked ? '#ffffff' : '#f4f4f5',
                border: `1px solid ${isChecked ? '#bef264' : '#e4e4e7'}`,
                boxShadow: isChecked ? '0 1px 3px 0 rgba(0, 0, 0, 0.03), 0 1px 2px 0 rgba(0, 0, 0, 0.01)' : 'none',
                fontSize: '12px',
                color: isChecked ? '#09090b' : '#71717a',
                userSelect: 'none',
                opacity: isInactive ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggleColumnVisibility(fieldInfo.key)}
                style={{ cursor: 'pointer', accentColor: '#52A628', width: '13px', height: '13px' }}
              />
              <span
                style={{
                  fontWeight: isChecked ? 600 : 400,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
                onClick={() => handleToggleColumnVisibility(fieldInfo.key)}
              >
                {getFieldTypeIcon(colType)}
                <span>{getFieldLabel(fieldInfo.key)}</span>
                {fieldInfo.key !== getFieldLabel(fieldInfo.key) && (
                  <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                    ({fieldInfo.key})
                  </span>
                )}
              </span>

              {/* Multi-table Unified Pill or Source lineage */}
              {unifiedCol && unifiedCol.sources && unifiedCol.sources.length > 1 ? (
                <button
                  data-testid={`unmerge-btn-${fieldInfo.key}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleUnmergeColumn(fieldInfo.key)
                  }}
                  title={isUnmerged ? '已拆分：點擊重新合併為統一欄位' : `已自動合併 ${unifiedCol.sources.length} 張表：點擊拆分為獨立欄位`}
                  style={{
                    background: 'none',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: isUnmerged ? '#dc2626' : '#52A628',
                    backgroundColor: isUnmerged ? '#fee2e2' : '#f7fee7',
                    border: `1px solid ${isUnmerged ? '#fca5a5' : '#d9f99d'}`,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: 500,
                  }}
                >
                  <Split size={10} />
                  {isUnmerged ? '已拆分' : `${unifiedCol.sources.length}表`}
                </button>
              ) : sources.length > 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`來源：${sources.map((s) => s.tableName || tablesMap[s.tableId]?.name || `Table ${s.tableId}`).join(', ')}`}>
                  {sources.map((s, sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: tablesMap[s.tableId]?.color || '#52A628',
                      }}
                    />
                  ))}
                </div>
              ) : null}

              {/* Type Mismatch Warning */}
              {unifiedCol?.hasTypeMismatch && (
                <span
                  title={`型別衝突 (${unifiedCol.mismatchedTypes.join(', ')})`}
                  style={{
                    fontSize: '10px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                >
                  <AlertTriangle size={10} />
                  衝突
                </span>
              )}

              {/* Aliased Badge */}
              {isAliased && (
                <span
                  title={`已套用自訂同義詞對照: ${customAliasMap[fieldInfo.key]}`}
                  style={{
                    fontSize: '10px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    backgroundColor: '#f7fee7',
                    border: '1px solid #d9f99d',
                    color: '#365314',
                  }}
                >
                  同義詞
                </span>
              )}

              {/* Coverage rate - clean muted badge only when > 0 */}
              {fieldInfo.coverageRate > 0 && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    backgroundColor: '#f4f4f5',
                    color: '#a1a1aa',
                  }}
                >
                  {fieldInfo.coverageRate}%
                </span>
              )}
            </div>
          )
        }

        return (
          <div
            data-testid="master-columns-bar"
            style={{
              padding: '14px 20px',
              backgroundColor: '#fafafa',
              borderBottom: '1px solid #e4e4e7',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '16px' }}>
              {/* Left Column: Source Tables Navigation with Focus action */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#27272a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <TableIcon size={13} color="#52A628" />
                    來源資料表 ({selectedTableIds.length === 0 ? Object.keys(tablesMap).length : selectedTableIds.length}/{Object.keys(tablesMap).length})
                  </span>
                  <button
                    onClick={() => setSelectedTableIds([])}
                    style={{
                      border: 'none',
                      background: 'none',
                      fontSize: '11px',
                      color: '#52A628',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    重置全部
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                  <button
                    onClick={() => setSelectedTableIds([])}
                    data-testid="table-chip-all"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      border: '1px solid',
                      borderColor: selectedTableIds.length === 0 ? '#bef264' : '#f4f4f5',
                      backgroundColor: selectedTableIds.length === 0 ? '#f7fee7' : '#ffffff',
                      color: selectedTableIds.length === 0 ? '#365314' : '#52525b',
                      fontWeight: selectedTableIds.length === 0 ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#52A628',
                        }}
                      />
                      <span>全部資料表</span>
                    </div>
                    <span style={{ fontSize: '11px', color: selectedTableIds.length === 0 ? '#52A628' : '#a1a1aa', fontVariantNumeric: 'tabular-nums' }}>
                      {totalRowsCount != null ? totalRowsCount : rows.length} 筆
                    </span>
                  </button>

                  {Object.entries(tablesMap).map(([tidStr, t]) => {
                    const tid = Number(tidStr)
                    const count = tableCounts[tid] || 0
                    const active = selectedTableIds.includes(tid)
                    const isFocused = active && selectedTableIds.length === 1

                    return (
                      <div
                        key={tid}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          border: '1px solid',
                          borderColor: active ? '#bef264' : '#f4f4f5',
                          backgroundColor: active ? '#f7fee7' : '#ffffff',
                          color: active ? '#365314' : '#52525b',
                          fontWeight: active ? 600 : 400,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <button
                          data-testid={`table-chip-${tid}`}
                          onClick={() =>
                            setSelectedTableIds((prev) =>
                              prev.includes(tid) ? prev.filter((id) => id !== tid) : [...prev, tid]
                            )
                          }
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            flex: 1,
                            overflow: 'hidden',
                            color: 'inherit',
                            fontWeight: 'inherit',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: t.color || '#52A628',
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name}
                          </span>
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', color: active ? '#52A628' : '#a1a1aa', fontVariantNumeric: 'tabular-nums' }}>
                            {count} 筆
                          </span>
                          <button
                            onClick={() => handleFocusTable(tid)}
                            title={isFocused ? '已聚焦此表（點擊重置全部）' : `僅聚焦檢視 ${t.name}`}
                            data-testid={`focus-table-btn-${tid}`}
                            style={{
                              border: `1px solid ${isFocused ? '#a3e635' : '#e4e4e7'}`,
                              background: isFocused ? '#ecfccb' : '#ffffff',
                              color: isFocused ? '#365314' : '#52525b',
                              borderRadius: '4px',
                              padding: '2px 5px',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Target size={10} />
                            {isFocused ? '已聚焦' : '聚焦'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Hierarchical Context-Aware Columns Manager */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)',
                }}
              >
                {/* Hub Header with Filter Tabs & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f4f4f5', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Segmented Filter Control Tabs */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        backgroundColor: '#f4f4f5',
                        padding: '2px',
                        borderRadius: '6px',
                        border: '1px solid #e4e4e7',
                      }}
                    >
                      <button
                        onClick={() => setFieldFilterTab('all')}
                        data-testid="tab-fields-all"
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: fieldFilterTab === 'all' ? 600 : 400,
                          backgroundColor: fieldFilterTab === 'all' ? '#ffffff' : 'transparent',
                          color: fieldFilterTab === 'all' ? '#09090b' : '#71717a',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: fieldFilterTab === 'all' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        全部 ({allFieldKeys.length})
                      </button>
                      <button
                        onClick={() => setFieldFilterTab('shared')}
                        data-testid="tab-fields-shared"
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: fieldFilterTab === 'shared' ? 600 : 400,
                          backgroundColor: fieldFilterTab === 'shared' ? '#ffffff' : 'transparent',
                          color: fieldFilterTab === 'shared' ? '#52A628' : '#71717a',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: fieldFilterTab === 'shared' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        🌐 通用 ({contextualFieldGroups.sharedFields.length})
                      </button>
                      <button
                        onClick={() => setFieldFilterTab('specific')}
                        data-testid="tab-fields-specific"
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: fieldFilterTab === 'specific' ? 600 : 400,
                          backgroundColor: fieldFilterTab === 'specific' ? '#ffffff' : 'transparent',
                          color: fieldFilterTab === 'specific' ? '#09090b' : '#71717a',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: fieldFilterTab === 'specific' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        📁 專屬
                      </button>
                      <button
                        onClick={() => setFieldFilterTab('filled')}
                        data-testid="tab-fields-filled"
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: fieldFilterTab === 'filled' ? 600 : 400,
                          backgroundColor: fieldFilterTab === 'filled' ? '#ffffff' : 'transparent',
                          color: fieldFilterTab === 'filled' ? '#09090b' : '#71717a',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: fieldFilterTab === 'filled' ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                        }}
                      >
                        ⚡ 僅含資料
                      </button>
                    </div>

                    {/* Smart Column Pruning Switch */}
                    <button
                      onClick={() => setSmartPrune((prev) => !prev)}
                      data-testid="toggle-smart-prune-btn"
                      title={smartPrune ? '已啟用：過濾子表時自動隱藏無關欄位' : '點擊啟用：過濾子表時自動隱藏無關欄位'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '2px 6px',
                        backgroundColor: smartPrune ? '#f0fdf4' : '#f4f4f5',
                        color: smartPrune ? '#166534' : '#71717a',
                        border: `1px solid ${smartPrune ? '#86efac' : '#e4e4e7'}`,
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: smartPrune ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Zap size={10} color={smartPrune ? '#16a34a' : '#a1a1aa'} />
                      <span>{smartPrune ? '智慧修剪中' : '智慧修剪'}</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Inline Column Filter Search */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        backgroundColor: '#f4f4f5',
                        border: '1px solid #e4e4e7',
                        borderRadius: '4px',
                        width: '110px',
                      }}
                    >
                      <Search size={11} color="#a1a1aa" />
                      <input
                        type="text"
                        placeholder="過濾欄位..."
                        value={columnFilterQuery}
                        onChange={(e) => setColumnFilterQuery(e.target.value)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          fontSize: '11px',
                          width: '100%',
                          backgroundColor: 'transparent',
                          color: '#18181b',
                        }}
                      />
                      {columnFilterQuery && (
                        <button
                          onClick={() => setColumnFilterQuery('')}
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                        >
                          <X size={10} color="#a1a1aa" />
                        </button>
                      )}
                    </div>

                    {/* Unified Batch Operations Button Group */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e4e4e7',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <button
                        onClick={handleResetToDefaultColumns}
                        data-testid="reset-columns-btn"
                        title="還原為系統預設常用欄位"
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#52525b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4f4f5')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <RotateCcw size={10} color="#71717a" />
                        <span>常用</span>
                      </button>

                      <div style={{ width: '1px', height: '12px', backgroundColor: '#e4e4e7' }} />

                      <button
                        onClick={handleSelectAllColumns}
                        data-testid="select-all-columns-btn"
                        title="顯示全部欄位"
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#52A628',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f7fee7')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Eye size={10} color="#52A628" />
                        <span>全選</span>
                      </button>

                      <div style={{ width: '1px', height: '12px', backgroundColor: '#e4e4e7' }} />

                      <button
                        onClick={handleClearAllColumns}
                        data-testid="clear-all-columns-btn"
                        title="隱藏/取消全部欄位"
                        style={{
                          border: 'none',
                          background: 'none',
                          padding: '3px 8px',
                          fontSize: '11px',
                          color: '#71717a',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <EyeOff size={10} color="#71717a" />
                        <span>清空</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setShowFieldMappingModal(true)}
                      data-testid="toggle-field-mapping-btn"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 9px',
                        backgroundColor: Object.keys(customAliasMap).length > 0 ? '#f7fee7' : '#ffffff',
                        color: Object.keys(customAliasMap).length > 0 ? '#52A628' : '#52525b',
                        border: `1px solid ${Object.keys(customAliasMap).length > 0 ? '#bef264' : '#e4e4e7'}`,
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Layers size={11} color={Object.keys(customAliasMap).length > 0 ? '#52A628' : '#71717a'} />
                      <span>同義詞對照{Object.keys(customAliasMap).length > 0 ? ` (${Object.keys(customAliasMap).length})` : ''}</span>
                    </button>
                  </div>
                </div>

                {/* Hierarchical Column Groups Body */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {/* 1. Shared / Cross-table Columns */}
                  {filteredSharedFields.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#52A628', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🌐 跨表通用欄位 ({filteredSharedFields.length})
                          <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 400 }}>
                            — 跨多張已選資料表對齊
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleToggleSharedFields(true)}
                            style={{
                              border: 'none',
                              background: 'none',
                              fontSize: '10px',
                              color: '#52A628',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            全選通用
                          </button>
                          <span style={{ color: '#e4e4e7', fontSize: '10px' }}>|</span>
                          <button
                            onClick={() => handleToggleSharedFields(false)}
                            style={{
                              border: 'none',
                              background: 'none',
                              fontSize: '10px',
                              color: '#71717a',
                              cursor: 'pointer',
                              padding: '0 4px',
                            }}
                          >
                            隱藏通用
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {filteredSharedFields.map((f) => renderFieldPill(f))}
                      </div>
                    </div>
                  )}

                  {/* 2. Table-Specific Columns with Collapsible Accordion */}
                  {Object.entries(filteredTableSpecificFields).map(([tidStr, fields]) => {
                    const tid = Number(tidStr)
                    if (!fields || fields.length === 0) return null
                    const t = tablesMap[tid]
                    const isCollapsed = collapsedTableGroups.has(tid)

                    return (
                      <div key={tid} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <button
                            onClick={() => handleToggleCollapseGroup(tid)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            {isCollapsed ? (
                              <ChevronRight size={13} color="#71717a" />
                            ) : (
                              <ChevronDown size={13} color="#71717a" />
                            )}
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: t?.color || '#52A628',
                              }}
                            />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#27272a' }}>
                              {t?.name || `Table ${tid}`} 專屬欄位 ({fields.length})
                            </span>
                            {isCollapsed && (
                              <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                                (已摺疊，點擊展開)
                              </span>
                            )}
                          </button>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => handleToggleTableFields(tid, true)}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '10px',
                                color: '#52A628',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '0 4px',
                              }}
                            >
                              全選此表
                            </button>
                            <span style={{ color: '#e4e4e7', fontSize: '10px' }}>|</span>
                            <button
                              onClick={() => handleToggleTableFields(tid, false)}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '10px',
                                color: '#71717a',
                                cursor: 'pointer',
                                padding: '0 4px',
                              }}
                            >
                              隱藏此表
                            </button>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {fields.map((f) => renderFieldPill(f))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* 3. Inactive Columns (belonging to unselected tables) */}
                  {filteredInactiveFields.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '8px',
                        backgroundColor: '#f4f4f5',
                        borderRadius: '6px',
                        border: '1px dashed #d4d4d8',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          💤 未選取子表欄位 ({filteredInactiveFields.length})
                          <span style={{ fontSize: '10px', color: '#a1a1aa' }}>
                            (所屬資料表未勾選，已自動淡出)
                          </span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {filteredInactiveFields.map((f) => renderFieldPill(f, true))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}




      {/* Expandable Filter Bar */}
      {showFilterBar && (
        <div
          data-testid="master-filter-bar"
          style={{
            padding: '12px 20px',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#27272a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} color="#52A628" />
              跨表篩選規則 ({filters.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAddFilter}
                data-testid="add-filter-rule-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  backgroundColor: '#52A628',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <Plus size={13} />
                新增條件
              </button>
              {filters.length > 0 && (
                <button
                  onClick={handleClearFilters}
                  data-testid="clear-filters-btn"
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#fff5f5',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  清除篩選
                </button>
              )}
            </div>
          </div>

          {filters.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#a1a1aa', padding: '4px 0' }}>
              目前無生效篩選規則。點擊「新增條件」篩選指定欄位與運算子。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filters.map((rule, idx) => (
                <div
                  key={idx}
                  data-testid={`filter-row-${idx}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {/* Field Selector */}
                  <select
                    value={rule.field}
                    data-testid={`filter-field-${idx}`}
                    onChange={(e) => handleUpdateFilter(idx, { field: e.target.value })}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e4e4e7',
                      fontSize: '12px',
                      backgroundColor: '#ffffff',
                      color: '#18181b',
                    }}
                  >
                    <option value="createdAt">建立時間 (createdAt)</option>
                    <option value="id">ID (id)</option>
                    {allFieldKeys.map((k) => (
                      <option key={k} value={k}>
                        {getFieldLabel(k)} {k !== getFieldLabel(k) ? `(${k})` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Operator Selector */}
                  <select
                    value={rule.operator}
                    data-testid={`filter-op-${idx}`}
                    onChange={(e) =>
                      handleUpdateFilter(idx, { operator: e.target.value as any })
                    }
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e4e4e7',
                      fontSize: '12px',
                      backgroundColor: '#ffffff',
                      color: '#18181b',
                    }}
                  >
                    <option value="contains">包含 (contains)</option>
                    <option value="not_contains">不包含 (not_contains)</option>
                    <option value="equals">等於 (equals)</option>
                    <option value="not_equals">不等於 (not_equals)</option>
                    <option value="higher_than">大於 (higher_than)</option>
                    <option value="lower_than">小於 (lower_than)</option>
                    <option value="is_empty">為空 (is_empty)</option>
                    <option value="is_not_empty">不為空 (is_not_empty)</option>
                  </select>

                  {/* Value Input */}
                  {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                    <input
                      type="text"
                      placeholder="輸入篩選值..."
                      value={rule.value || ''}
                      data-testid={`filter-val-${idx}`}
                      onChange={(e) => handleUpdateFilter(idx, { value: e.target.value })}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #e4e4e7',
                        fontSize: '12px',
                        width: '180px',
                        color: '#18181b',
                      }}
                    />
                  )}

                  {/* Delete Rule Button */}
                  <button
                    onClick={() => handleRemoveFilter(idx)}
                    data-testid={`remove-filter-${idx}`}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ef4444',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid Container */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Secondary Loading Progress Shimmer */}
        {loading && rows.length > 0 && (
          <div
            data-testid="master-reloading-bar"
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              width: '100%',
              zIndex: 35,
              background: 'linear-gradient(90deg, #52A628 0%, #EA580C 50%, #52A628 100%)',
              backgroundSize: '200% 100%',
              animation: 'fycdBarShimmer 1.8s ease-in-out infinite',
            }}
          />
        )}

        {loading && rows.length === 0 ? (
          <WorkspaceGridSkeleton loadingText="正在彙整跨表資料列..." />
        ) : error ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '300px',
              gap: '12px',
              color: '#ef4444',
            }}
          >
            <Info size={28} />
            <div>{error}</div>
            <button
              onClick={() => fetchRows(null)}
              style={{
                padding: '6px 16px',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #f87171',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              再試一次
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            data-testid="master-empty-state"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '340px',
              gap: '16px',
              color: '#71717a',
              padding: '24px',
            }}
          >
            <TableIcon size={36} color="#a1a1aa" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#09090b', marginBottom: '4px' }}>
                {searchQuery ? `查無符合「${searchQuery}」的跨表資料` : '目前尚無跨表資料'}
              </div>
              <div style={{ fontSize: '12px', color: '#71717a', maxWidth: '400px' }}>
                {searchQuery
                  ? '請嘗試更換關鍵字或清除篩選條件'
                  : '跨表總表會自動彙整工作區內各子表的資料列，並依照同名欄位自動對齊。'}
              </div>
            </div>

            {!searchQuery && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  maxWidth: '560px',
                  width: '100%',
                  marginTop: '8px',
                }}
              >
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fafafa', border: '1px solid #e4e4e7', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#52A628', marginBottom: '2px' }}>步驟 1</div>
                  <div style={{ fontSize: '11px', color: '#52525b' }}>在工作區新增各子資料表</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fafafa', border: '1px solid #e4e4e7', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#52A628', marginBottom: '2px' }}>步驟 2</div>
                  <div style={{ fontSize: '11px', color: '#52525b' }}>系統自動同名對齊與來源標註</div>
                </div>
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fafafa', border: '1px solid #e4e4e7', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#52A628', marginBottom: '2px' }}>步驟 3</div>
                  <div style={{ fontSize: '11px', color: '#52525b' }}>隨時獨立覆寫與匯出 CSV</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            {/* Table Header (Sticky Top) */}
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                backgroundColor: '#fafafa',
                borderBottom: '1px solid #e4e4e7',
              }}
            >
              <tr>
                <th
                  style={{
                    padding: '10px 14px',
                    width: '60px',
                    color: '#71717a',
                    fontWeight: 600,
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    backgroundColor: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <input
                      type="checkbox"
                      data-testid="select-all-rows-checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected
                      }}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', accentColor: '#52A628', width: '13px', height: '13px' }}
                      title="全選 / 取消全選"
                    />
                  </div>
                </th>
                <th
                  style={{
                    padding: '10px 14px',
                    width: '160px',
                    color: '#71717a',
                    fontWeight: 600,
                    position: 'sticky',
                    left: '60px',
                    zIndex: 30,
                    backgroundColor: '#fafafa',
                    borderRight: '1px solid #e4e4e7',
                  }}
                >
                  來源資料表
                </th>
                {visibleFieldKeys.map((key) => {
                  const isSorted = sortField === key
                  const colType = unifiedColumnsMap[key]?.type || fieldsMap[key]?.type
                  const unifiedCol = unifiedColumnsMap[key]
                  const isPinned = pinnedKeys.includes(key)

                  // Calculate sticky left offset for pinned columns
                  const stickyLeft = isPinned ? getPinnedStickyLeft(key) : undefined

                  return (
                    <th
                      key={key}
                      onClick={() => handleToggleSort(key)}
                      data-testid={`sort-header-${key}`}
                      style={{
                        padding: '10px 14px',
                        color: isSorted ? '#52A628' : '#3f3f46',
                        backgroundColor: isSorted ? '#f7fee7' : isPinned ? '#f4f4f5' : 'transparent',
                        fontWeight: 600,
                        minWidth: '150px',
                        borderLeft: '1px solid #f4f4f5',
                        cursor: 'pointer',
                        userSelect: 'none',
                        position: isPinned ? 'sticky' : undefined,
                        left: stickyLeft,
                        zIndex: isPinned ? 25 : undefined,
                        boxShadow: isPinned ? '4px 0 6px -2px rgba(0, 0, 0, 0.04)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            overflow: 'hidden',
                          }}
                        >
                          {getFieldTypeIcon(colType)}
                          <span
                            title={`${getFieldLabel(key)} (${key})`}
                            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          >
                            {getFieldLabel(key)}
                          </span>
                          {unifiedCol?.hasTypeMismatch && (
                            <span
                              data-testid={`type-mismatch-icon-${key}`}
                              title={`⚠️ 型別不一致 (${unifiedCol.mismatchedTypes.join(', ')})：部分來源資料表型別不同，可能影響顯示或統計`}
                              style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
                            >
                              <AlertTriangle size={13} color="#d97706" />
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          {/* Pin Toggle */}
                          <button
                            data-testid={`pin-col-${key}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleTogglePinColumn(key)
                            }}
                            title={isPinned ? '取消釘選' : '釘選此欄位（固定在左側）'}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              padding: '2px',
                              color: isPinned ? '#52A628' : '#a1a1aa',
                            }}
                          >
                            {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
                          </button>

                          {/* Info / Sources popover */}
                          {unifiedCol && unifiedCol.sources && unifiedCol.sources.length > 0 && (
                            <div style={{ position: 'relative' }}>
                              <button
                                data-testid={`col-info-btn-${key}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveColumnPopover(activeColumnPopover === key ? null : key)
                                }}
                                title="查看欄位來源組成與對照設定"
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: activeColumnPopover === key ? '#52A628' : '#a1a1aa',
                                }}
                              >
                                <Info size={12} />
                              </button>

                              {activeColumnPopover === key && (
                                <div
                                  data-testid={`col-sources-popover-${key}`}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '6px',
                                    zIndex: 50,
                                    width: '260px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #e4e4e7',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                    padding: '12px',
                                    fontSize: '12px',
                                    color: '#27272a',
                                    textAlign: 'left',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f4f4f5', paddingBottom: '6px' }}>
                                    <span style={{ fontWeight: 600, color: '#09090b' }}>欄位來源組成</span>
                                    <button
                                      onClick={() => setActiveColumnPopover(null)}
                                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#a1a1aa' }}
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>

                                  <div style={{ marginBottom: '8px', fontSize: '11px', color: '#71717a' }}>
                                    此統一欄位整合了下列子表的欄位資料：
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                    {unifiedCol.sources.map((s, sIdx) => (
                                      <div
                                        key={sIdx}
                                        style={{
                                          padding: '4px 8px',
                                          backgroundColor: '#fafafa',
                                          borderRadius: '4px',
                                          border: '1px solid #e4e4e7',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          fontSize: '11px',
                                        }}
                                      >
                                        <div>
                                          <span style={{ fontWeight: 600, color: '#27272a' }}>
                                            {s.tableName || `表 ${s.tableId}`}
                                          </span>
                                          <span style={{ color: '#71717a', marginLeft: '4px' }}>
                                            : {s.fieldName}
                                          </span>
                                        </div>
                                        <span style={{ fontSize: '10px', color: '#365314', backgroundColor: '#f7fee7', padding: '1px 4px', borderRadius: '3px' }}>
                                          {s.type}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {unifiedCol.hasTypeMismatch && (
                                    <div style={{ padding: '6px 8px', backgroundColor: '#fef3c7', borderRadius: '4px', color: '#92400e', fontSize: '11px', marginBottom: '10px' }}>
                                      ⚠️ 注意：此欄位整合了不同型別的來源欄位 ({unifiedCol.mismatchedTypes.join(', ')})，部分資料可能顯示異常。
                                    </div>
                                  )}

                                  <button
                                    data-testid={`toggle-unmerge-btn-${key}`}
                                    onClick={() => handleToggleUnmergeColumn(key)}
                                    style={{
                                      width: '100%',
                                      padding: '5px 8px',
                                      backgroundColor: unmergedKeys.includes(key) ? '#f7fee7' : '#f4f4f5',
                                      border: `1px solid ${unmergedKeys.includes(key) ? '#bef264' : '#e4e4e7'}`,
                                      borderRadius: '5px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      color: unmergedKeys.includes(key) ? '#52A628' : '#52525b',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <Split size={12} />
                                    {unmergedKeys.includes(key) ? '重新合併為統一欄位' : '取消合併（拆分為個別欄位）'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp size={13} color="#52A628" data-testid="sort-asc-icon" />
                            ) : (
                              <ArrowDown size={13} color="#52A628" data-testid="sort-desc-icon" />
                            )
                          ) : (
                            <ArrowUpDown size={12} color="#a1a1aa" />
                          )}
                        </div>
                      </div>
                    </th>
                  )
                })}
                <th
                  onClick={() => handleToggleSort('createdAt')}
                  data-testid="sort-header-createdAt"
                  style={{
                    padding: '10px 14px',
                    width: '160px',
                    color: sortField === 'createdAt' ? '#52A628' : '#71717a',
                    backgroundColor: sortField === 'createdAt' ? '#f7fee7' : 'transparent',
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span>建立時間</span>
                    {sortField === 'createdAt' ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={13} color="#52A628" />
                      ) : (
                        <ArrowDown size={13} color="#52A628" />
                      )
                    ) : (
                      <ArrowUpDown size={12} color="#a1a1aa" />
                    )}
                  </div>
                </th>
                <th style={{ padding: '10px 14px', width: '90px', textAlign: 'center', color: '#71717a', fontWeight: 600 }}>
                  操作
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody
              style={{
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? 'none' : 'auto',
                transition: 'opacity 0.2s ease',
              }}
            >
              {groupByTable ? (
                Object.entries(
                  filteredRows.reduce<Record<number, MasterViewRowWithOverrides[]>>((acc, r) => {
                    if (!acc[r.tableId]) acc[r.tableId] = []
                    acc[r.tableId].push(r)
                    return acc
                  }, {})
                ).map(([tidStr, tableRows]) => {
                  const tid = Number(tidStr)
                  const tableInfo = tablesMap[tid] || { name: `資料表 ${tid}`, color: '#52A628' }
                  const isCollapsed = collapsedTableGroups.has(tid)

                  return (
                    <React.Fragment key={`group-${tid}`}>
                      <tr
                        onClick={() => handleToggleCollapseGroup(tid)}
                        style={{
                          backgroundColor: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <td
                          colSpan={visibleFieldKeys.length + 4}
                          style={{
                            padding: '8px 14px',
                            fontWeight: 600,
                            fontSize: '12px',
                            color: '#334155',
                            position: 'sticky',
                            left: 0,
                            zIndex: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isCollapsed ? <ChevronRight size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: tableInfo.color || '#52A628',
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{tableInfo.name}</span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                              ({tableRows.length} 筆資料)
                            </span>
                          </div>
                        </td>
                      </tr>

                      {!isCollapsed &&
                        tableRows.map((row, idx) => {
                          return (
                            <tr
                              key={`${row.tableId}-${row.id}`}
                              data-testid={`master-row-${row.tableId}-${row.id}`}
                              style={{
                                borderBottom: '1px solid #f4f4f5',
                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                                transition: 'background-color 0.15s ease',
                              }}
                            >
                              {/* Index & Selection Checkbox */}
                              <td
                                style={{
                                  padding: '10px 14px',
                                  color: '#a1a1aa',
                                  fontSize: '12px',
                                  textAlign: 'center',
                                  position: 'sticky',
                                  left: 0,
                                  zIndex: 10,
                                  backgroundColor: selectedRowKeys.has(`${row.tableId}_${row.id}`) ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <input
                                    type="checkbox"
                                    data-testid={`select-row-checkbox-${row.tableId}-${row.id}`}
                                    checked={selectedRowKeys.has(`${row.tableId}_${row.id}`)}
                                    onChange={() => toggleSelectRow(row.tableId, row.id)}
                                    style={{ cursor: 'pointer', accentColor: '#52A628', width: '13px', height: '13px' }}
                                  />
                                  <span>{idx + 1}</span>
                                </div>
                              </td>

                              {/* Source Table Badge */}
                              <td
                                style={{
                                  padding: '10px 14px',
                                  position: 'sticky',
                                  left: '60px',
                                  zIndex: 10,
                                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                                  borderRight: '1px solid #f4f4f5',
                                }}
                              >
                                <span
                                  data-testid={`source-table-badge-${row.tableId}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    backgroundColor: '#f4f4f5',
                                    color: '#27272a',
                                    border: '1px solid #e4e4e7',
                                  }}
                                >
                                  <TableIcon size={12} color={tableInfo.color || '#52A628'} />
                                  {tableInfo.name}
                                </span>
                              </td>

                              {/* Dynamic Fields via MasterGridCell */}
                              {visibleFieldKeys.map((key) => {
                                const tableFieldKey = unifiedColumnsMap[key]?.tableFieldMap[row.tableId] || key
                                const isOverridden =
                                  row._hasOverride &&
                                  Array.isArray(row._overrideKeys) &&
                                  (row._overrideKeys.includes(key) || row._overrideKeys.includes(tableFieldKey))

                                const originalVal = getRowFieldValue(
                                  { tableId: row.tableId, data: row._originalData },
                                  key,
                                  unifiedColumnsMap,
                                  fieldsMap
                                )

                                const isPinned = pinnedKeys.includes(key)
                                const stickyLeft = isPinned ? getPinnedStickyLeft(key) : undefined

                                return (
                                  <MasterGridCell
                                    key={key}
                                    row={row}
                                    fieldKey={key}
                                    rowIndex={idx}
                                    unifiedColumnsMap={unifiedColumnsMap}
                                    fieldsMap={fieldsMap}
                                    isPinned={isPinned}
                                    stickyLeft={stickyLeft}
                                    isOverridden={Boolean(isOverridden)}
                                    originalVal={originalVal}
                                    activeOverridePopover={activeOverridePopover}
                                    revertingOverride={revertingOverride}
                                    onToggleOverridePopover={setActiveOverridePopover}
                                    onRevertOverride={handleRevertOverride}
                                    onOpenDrawer={setSelectedDrawerRow}
                                  />
                                )
                              })}

                              {/* CreatedAt */}
                              <td style={{ padding: '10px 14px', color: '#71717a', fontSize: '12px' }}>
                                {new Date(row.createdAt).toLocaleDateString()}
                              </td>

                              {/* Actions / Detail Drawer Trigger */}
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                <button
                                  data-testid="open-drawer-btn"
                                  onClick={() =>
                                    setSelectedDrawerRow({
                                      tableId: row.tableId,
                                      rowId: row.id,
                                      tableName: tableInfo.name,
                                    })
                                  }
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 8px',
                                    border: '1px solid #e4e4e7',
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    color: '#3f3f46',
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <ExternalLink size={12} />
                                  詳情
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })
              ) : (
                filteredRows.map((row, idx) => {
                  const tableInfo = tablesMap[row.tableId] || {
                    name: `Table ${row.tableId}`,
                    color: '#52A628',
                  }

                  return (
                    <tr
                      key={`${row.tableId}-${row.id}`}
                      data-testid={`master-row-${row.tableId}-${row.id}`}
                      style={{
                        borderBottom: '1px solid #f4f4f5',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      {/* Index & Selection Checkbox */}
                      <td
                        style={{
                          padding: '10px 14px',
                          color: '#a1a1aa',
                          fontSize: '12px',
                          textAlign: 'center',
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          backgroundColor: selectedRowKeys.has(`${row.tableId}_${row.id}`) ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <input
                            type="checkbox"
                            data-testid={`select-row-checkbox-${row.tableId}-${row.id}`}
                            checked={selectedRowKeys.has(`${row.tableId}_${row.id}`)}
                            onChange={() => toggleSelectRow(row.tableId, row.id)}
                            style={{ cursor: 'pointer', accentColor: '#52A628', width: '13px', height: '13px' }}
                          />
                          <span>{idx + 1}</span>
                        </div>
                      </td>

                      {/* Source Table Badge */}
                      <td
                        style={{
                          padding: '10px 14px',
                          position: 'sticky',
                          left: '60px',
                          zIndex: 10,
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafaf9',
                          borderRight: '1px solid #f4f4f5',
                        }}
                      >
                        <span
                          data-testid={`source-table-badge-${row.tableId}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 500,
                            backgroundColor: '#f4f4f5',
                            color: '#27272a',
                            border: '1px solid #e4e4e7',
                          }}
                        >
                          <TableIcon size={12} color={tableInfo.color || '#52A628'} />
                          {tableInfo.name}
                        </span>
                      </td>

                      {/* Dynamic Fields via MasterGridCell */}
                      {visibleFieldKeys.map((key) => {
                        const tableFieldKey = unifiedColumnsMap[key]?.tableFieldMap[row.tableId] || key
                        const isOverridden =
                          row._hasOverride &&
                          Array.isArray(row._overrideKeys) &&
                          (row._overrideKeys.includes(key) || row._overrideKeys.includes(tableFieldKey))

                        const originalVal = getRowFieldValue(
                          { tableId: row.tableId, data: row._originalData },
                          key,
                          unifiedColumnsMap,
                          fieldsMap
                        )

                        const isPinned = pinnedKeys.includes(key)
                        const stickyLeft = isPinned ? getPinnedStickyLeft(key) : undefined

                        return (
                          <MasterGridCell
                            key={key}
                            row={row}
                            fieldKey={key}
                            rowIndex={idx}
                            unifiedColumnsMap={unifiedColumnsMap}
                            fieldsMap={fieldsMap}
                            isPinned={isPinned}
                            stickyLeft={stickyLeft}
                            isOverridden={Boolean(isOverridden)}
                            originalVal={originalVal}
                            activeOverridePopover={activeOverridePopover}
                            revertingOverride={revertingOverride}
                            onToggleOverridePopover={setActiveOverridePopover}
                            onRevertOverride={handleRevertOverride}
                            onOpenDrawer={setSelectedDrawerRow}
                          />
                        )
                      })}

                      {/* CreatedAt */}
                      <td style={{ padding: '10px 14px', color: '#71717a', fontSize: '12px' }}>
                        {new Date(row.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions / Detail Drawer Trigger */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          data-testid="open-drawer-btn"
                          onClick={() =>
                            setSelectedDrawerRow({
                              tableId: row.tableId,
                              rowId: row.id,
                              tableName: tableInfo.name,
                            })
                          }
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            border: '1px solid #e4e4e7',
                            borderRadius: '4px',
                            backgroundColor: '#ffffff',
                            color: '#3f3f46',
                            fontSize: '11px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <ExternalLink size={12} />
                          詳情
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Table Footer / Summary Bar (Sticky Bottom) */}
            <tfoot
              data-testid="master-grid-footer"
              style={{
                position: 'sticky',
                bottom: 0,
                zIndex: 20,
                backgroundColor: '#fafafa',
                borderTop: '1px solid #e4e4e7',
                fontSize: '12px',
                fontWeight: 500,
                color: '#52525b',
              }}
            >
              <tr>
                <td
                  data-testid="footer-count-cell"
                  style={{
                    padding: '8px 14px',
                    color: '#71717a',
                    fontWeight: 600,
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    backgroundColor: '#fafafa',
                    textAlign: 'center',
                  }}
                >
                  {filteredRows.length === rows.length ? `${rows.length} 筆` : `${filteredRows.length}/${rows.length} 筆`}
                </td>
                <td
                  style={{
                    padding: '8px 14px',
                    color: '#71717a',
                    fontWeight: 600,
                    position: 'sticky',
                    left: '60px',
                    zIndex: 30,
                    backgroundColor: '#fafafa',
                    borderRight: '1px solid #e4e4e7',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>跨表統計</span>
                    <span style={{ fontSize: '10px', color: '#365314', backgroundColor: '#f7fee7', border: '1px solid #d9f99d', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                      已載入
                    </span>
                    <span
                      data-testid="footer-permission-info-icon"
                      title={`此統計針對當前已載入的 ${filteredRows.length} 筆資料進行即時彙整，涵蓋您有權限檢視的 ${permissionInfo?.authorizedTablesCount ?? Object.keys(tablesMap).length} 張資料表`}
                      style={{ cursor: 'help', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <Info size={12} color="#a1a1aa" />
                    </span>
                  </div>
                </td>

                {visibleFieldKeys.map((key) => {
                  const summary = computeColumnSummary(filteredRows, key, unifiedColumnsMap, fieldsMap)
                  const isNumeric = summary.sum !== null
                  const mode = aggregationModes[key] || (isNumeric ? 'sum' : 'count')

                  let displayText = ''
                  if (mode === 'count') displayText = `${summary.count} 筆`
                  else if (mode === 'empty_count') displayText = `空 ${summary.emptyCount}`
                  else if (mode === 'percent') displayText = `${summary.percentFilled}%`
                  else if (mode === 'sum') displayText = summary.sum !== null ? `Σ ${summary.sum}` : `${summary.count} 筆`
                  else if (mode === 'avg') displayText = summary.avg !== null ? `x̄ ${summary.avg}` : `${summary.count} 筆`
                  else if (mode === 'min') displayText = summary.min !== null ? `Min ${summary.min}` : '—'
                  else if (mode === 'max') displayText = summary.max !== null ? `Max ${summary.max}` : '—'
                  else if (mode === 'unique') displayText = `唯一 ${summary.uniqueCount}`
                  else if (mode === 'none') displayText = ''

                  const isPinned = pinnedKeys.includes(key)
                  const stickyLeft = isPinned ? getPinnedStickyLeft(key) : undefined

                  return (
                    <td
                      key={key}
                      style={{
                        padding: '6px 10px',
                        borderLeft: '1px solid #f4f4f5',
                        position: isPinned ? 'sticky' : undefined,
                        left: stickyLeft,
                        zIndex: isPinned ? 25 : undefined,
                        backgroundColor: '#fafafa',
                        boxShadow: isPinned ? '4px 0 6px -2px rgba(0, 0, 0, 0.04)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span data-testid={`summary-text-${key}`} style={{ fontWeight: 600, color: '#27272a' }}>
                            {displayText}
                          </span>
                          {summary.excludedMismatchCount > 0 &&
                            (mode === 'sum' || mode === 'avg' || mode === 'min' || mode === 'max') && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  data-testid={`excluded-mismatch-indicator-${key}`}
                                  onClick={() =>
                                    setActiveExcludedMismatchPopover(
                                      activeExcludedMismatchPopover === key ? null : key
                                    )
                                  }
                                  title={`點擊查看被排除了哪 ${summary.excludedMismatchCount} 筆非數值資料`}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '0',
                                    fontSize: '10px',
                                    color: '#d97706',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  ⚠️({summary.excludedMismatchCount} 筆已排除)
                                </button>

                                {activeExcludedMismatchPopover === key && (
                                  <div
                                    data-testid={`excluded-mismatch-popover-${key}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      bottom: '100%',
                                      left: 0,
                                      marginBottom: '6px',
                                      zIndex: 50,
                                      width: '260px',
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #e4e4e7',
                                      borderRadius: '8px',
                                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                      padding: '12px',
                                      fontSize: '12px',
                                      color: '#27272a',
                                      textAlign: 'left',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                      <span style={{ fontWeight: 600, color: '#92400e', fontSize: '12px' }}>
                                        因型別不符未計入計算 ({summary.excludedRows.length} 筆)
                                      </span>
                                      <button
                                        onClick={() => setActiveExcludedMismatchPopover(null)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#a1a1aa', padding: '2px' }}
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                    <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {summary.excludedRows.map((item, idx) => (
                                        <div
                                          key={idx}
                                          style={{
                                            padding: '4px 8px',
                                            backgroundColor: '#fef3c7',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '6px',
                                          }}
                                        >
                                          <span style={{ color: '#78350f', fontWeight: 500 }}>
                                            {tablesMap[item.tableId]?.name || `表 ${item.tableId}`} #{item.rowId}
                                          </span>
                                          <span style={{ color: '#92400e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            值: &quot;{String(item.value)}&quot;
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                        <select
                          value={mode}
                          data-testid={`summary-select-${key}`}
                          onChange={(e) =>
                            handleUpdateMasterAggregationMode(key, e.target.value)
                          }
                          style={{
                            fontSize: '11px',
                            border: '1px solid #e4e4e7',
                            borderRadius: '4px',
                            padding: '1px 3px',
                            backgroundColor: '#ffffff',
                            color: '#52525b',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="none">隱藏</option>
                          <option value="count">計數 (count)</option>
                          <option value="empty_count">未填寫 (empty)</option>
                          <option value="percent">填寫率 (percent)</option>
                          {isNumeric && <option value="sum">加總 (sum Σ)</option>}
                          {isNumeric && <option value="avg">平均 (avg x̄)</option>}
                          <option value="min">最小值 (min)</option>
                          <option value="max">最大值 (max)</option>
                          <option value="unique">不重複值 (unique)</option>
                        </select>
                      </div>
                    </td>
                  )
                })}
                <td style={{ padding: '8px 14px', color: '#71717a' }}>
                  {filteredRows.length} 筆
                </td>
                <td style={{ padding: '8px 14px' }}></td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Load More Pagination */}
        {nextCursor && !loading && (
          <div style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid #f4f4f5' }}>
            <button
              onClick={() => fetchRows(nextCursor)}
              disabled={loadingMore}
              data-testid="load-more-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 24px',
                backgroundColor: '#ffffff',
                border: '1px solid #e4e4e7',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#3f3f46',
                cursor: loadingMore ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)',
                transition: 'all 0.15s ease',
              }}
            >
              {loadingMore ? (
                <>
                  <Loader2 size={13} className="animate-spin" color="#52A628" />
                  <span>正在載入更多...</span>
                </>
              ) : (
                <span>載入更多資料列</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Field Mapping Assistant Modal */}
      <FieldMappingModal
        show={showFieldMappingModal}
        onClose={() => setShowFieldMappingModal(false)}
        fieldsMap={fieldsMap}
        tablesMap={tablesMap}
        unmergedKeys={unmergedKeys}
        customAliasMap={customAliasMap}
        onApplyMapping={handleApplyMapping}
      />

      {/* Slide-over CardDrawer */}
      {selectedDrawerRow && (
        <CardDrawer
          show={!!selectedDrawerRow}
          tableId={selectedDrawerRow.tableId}
          rowId={selectedDrawerRow.rowId}
          tableName={selectedDrawerRow.tableName}
          onClose={() => setSelectedDrawerRow(null)}
          onRowUpdated={handleRowUpdated}
          readOnly={readOnly}
          isMasterViewContext={true}
        />
      )}

      {/* Floating Bulk Actions Bar */}
      {selectedRowKeys.size > 0 && (
        <div
          data-testid="bulk-actions-floating-bar"
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            backgroundColor: '#18181b',
            color: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#52A628' }} />
            <span>已選取 {selectedRowKeys.size} 筆資料</span>
          </div>

          <div style={{ height: '16px', width: '1px', backgroundColor: '#3f3f46' }} />

          <button
            onClick={handleExportCsv}
            data-testid="bulk-export-csv-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              backgroundColor: '#27272a',
              color: '#ffffff',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
          >
            <Download size={13} color="#52A628" />
            <span>匯出所選 CSV ({selectedRowKeys.size})</span>
          </button>

          {masterViewId && (
            <button
              onClick={handleBatchRevertOverrides}
              data-testid="bulk-revert-overrides-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                backgroundColor: '#27272a',
                color: '#ffffff',
                border: '1px solid #3f3f46',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3f3f46')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#27272a')}
            >
              <RotateCcw size={13} color="#f59e0b" />
              <span>批量還原覆寫</span>
            </button>
          )}

          <button
            onClick={() => setSelectedRowKeys(new Set())}
            data-testid="deselect-all-btn"
            style={{
              padding: '5px 10px',
              backgroundColor: 'transparent',
              color: '#a1a1aa',
              border: 'none',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
          >
            取消選取
          </button>
        </div>
      )}
    </div>
  )
}

