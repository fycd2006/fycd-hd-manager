import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeft, PanelLeftClose, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, Search, AlignJustify, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, X, MoreVertical, GripVertical, Trash2, Undo2, Redo2, MoreHorizontal, Download, Upload } from 'lucide-react'
import type { TableView, TableField, FilterRule, RowColorRule, GroupByRule, SortRule } from '@/modules/database/types'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import { ViewContextMenu } from '@/modules/database/components/menu/ViewContextMenu'
import { FilterMenu } from './menu/FilterMenu'
import { SortMenu } from './menu/SortMenu'
import { ColorMenu } from './menu/ColorMenu'
import { GroupMenu } from './menu/GroupMenu'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'


interface ViewToolbarProps {
  // Sidebar state
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: (v: boolean) => void

  // View state
  views: TableView[]
  activeViewId: number | null
  setActiveViewId: (id: number) => void
  applyViewConfig: (view: TableView) => void
  setShowNewViewModal: (v: boolean) => void
  saveViewConfig: (viewId: number, config: any) => void
  onDuplicateView?: (viewId: number) => void
  onDeleteView?: (viewId: number) => void
  onRenameView?: (viewId: number) => void

  // Search
  searchQuery: string
  setSearchQuery: (v: string) => void

  // Sort
  sortField: string | null
  setSortField: (v: string | null) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (v: 'asc' | 'desc') => void
  sortRules?: SortRule[]
  setSortRules?: (v: SortRule[]) => void

  // Filter
  filterRules: FilterRule[]
  setFilterRules: (v: FilterRule[]) => void
  filterType?: 'AND' | 'OR'
  setFilterType?: (v: 'AND' | 'OR') => void

  // Color rules
  rowColorRules: RowColorRule[]
  setRowColorRules: (v: RowColorRule[]) => void

  // Group
  groupByField?: string | null
  setGroupByField?: (v: string | null) => void
  groupByRules?: GroupByRule[]
  setGroupByRules?: (v: GroupByRule[]) => void
  onToggleCollapseAllGroups?: (collapse: boolean) => void

  // Fields (hide/show)
  fields: TableField[]
  hiddenFieldKeys: string[]
  setHiddenFieldKeys: (v: string[]) => void

  // Row Height
  rowHeightSize: 'small' | 'medium' | 'large' | 'extra'
  setRowHeightSize: (v: 'small' | 'medium' | 'large' | 'extra') => void

  // CSV
  handleExportCSV: () => void
  handleCSVImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  csvInputRef: React.RefObject<HTMLInputElement | null>
  canManageStructure?: boolean
  onImportAirtable?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function ViewToolbar({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  views,
  activeViewId,
  setActiveViewId,
  applyViewConfig,
  setShowNewViewModal,
  saveViewConfig,
  onDuplicateView,
  onDeleteView,
  onRenameView,
  searchQuery,
  setSearchQuery,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  sortRules,
  setSortRules,
  filterRules,
  setFilterRules,
  filterType = 'AND',
  setFilterType,
  rowColorRules,
  setRowColorRules,
  groupByField,
  setGroupByField,
  groupByRules,
  setGroupByRules,
  onToggleCollapseAllGroups,
  fields,
  hiddenFieldKeys,
  setHiddenFieldKeys,
  rowHeightSize,
  setRowHeightSize,
  handleExportCSV,
  handleCSVImport,
  csvInputRef,
  canManageStructure,
  onImportAirtable,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: ViewToolbarProps) {
  const { t } = useI18n()

  const activeSortRules: SortRule[] = React.useMemo(() => {
    if (sortRules && sortRules.length > 0) return sortRules;
    if (sortField) {
      if (typeof sortField === 'string' && sortField.startsWith('[')) {
        try {
          const parsed = JSON.parse(sortField);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      return [{ fieldKey: sortField, order: sortOrder || 'asc' }];
    }
    return [];
  }, [sortRules, sortField, sortOrder]);

  const handleSetSortRules = React.useCallback((rules: SortRule[]) => {
    setSortRules?.(rules);
    const primaryKey = rules.length > 0 ? rules[0].fieldKey : null;
    const primaryOrder = rules.length > 0 ? rules[0].order : 'asc';
    setSortField(primaryKey);
    setSortOrder(primaryOrder);
    if (activeViewId) {
      saveViewConfig(activeViewId, {
        sortField: primaryKey,
        sortOrder: primaryOrder,
        sortRules: rules,
      });
    }
  }, [setSortRules, setSortField, setSortOrder, activeViewId, saveViewConfig]);

  const activeGroupByRules: GroupByRule[] = React.useMemo(() => {
    if (groupByRules && groupByRules.length > 0) return groupByRules;
    if (groupByField) {
      if (typeof groupByField === 'string' && groupByField.startsWith('[')) {
        try {
          const parsed = JSON.parse(groupByField);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      return [{ fieldKey: groupByField, order: 'asc' }];
    }
    return [];
  }, [groupByRules, groupByField]);

  const handleSetGroupByRules = React.useCallback((rules: GroupByRule[]) => {
    setGroupByRules?.(rules);
    const primaryKey = rules.length > 0 ? rules[0].fieldKey : null;
    setGroupByField?.(primaryKey);
    if (activeViewId) {
      saveViewConfig(activeViewId, {
        groupByField: rules.length > 0 ? JSON.stringify(rules) : null,
        groupByRules: rules,
      });
    }
  }, [setGroupByRules, setGroupByField, activeViewId, saveViewConfig]);
  const safeRowColorRules = Array.isArray(rowColorRules) ? rowColorRules : [];
  const safeFilterRules = Array.isArray(filterRules) ? filterRules : [];
  const safeFields = Array.isArray(fields) ? fields : [];
  const safeHiddenFieldKeys = Array.isArray(hiddenFieldKeys) ? hiddenFieldKeys : [];
  const safeViews = Array.isArray(views) ? views : [];

  const [isMobile, setIsMobile] = useState(false)
  const [showViewContext, setShowViewContext] = useState(false)
  const [showViewOptionsMenu, setShowViewOptionsMenu] = useState(false)
  const [selectedViewForMenu, setSelectedViewForMenu] = useState<TableView | null>(null)
  const [activeHeaderMenu, setActiveHeaderMenu] = useState<string | null>(null)
  const [fieldSearchQuery, setFieldSearchQuery] = useState('')

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const actualHiddenCount = React.useMemo(() => {
    return fields.filter(f => hiddenFieldKeys.includes(`field_${f.id}`) || hiddenFieldKeys.includes(String(f.id))).length
  }, [fields, hiddenFieldKeys])

  const filteredFieldsForHide = fields.filter(f =>
    f.name.toLowerCase().includes(fieldSearchQuery.toLowerCase())
  )

  const getFieldIcon = (type: string) => {
    const IconFunc = FIELD_TYPE_ICONS[type]
    if (IconFunc) {
      return IconFunc()
    }
    return <LayoutGrid size={14} />
  }

  const headerToolbarRef = useRef<HTMLElement>(null)
  const viewContextRef = useRef<HTMLLIElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const popoverMenuRef = useRef<HTMLDivElement>(null)

  const [menuAnchorRect, setMenuAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const openMenuWithAnchor = (menuName: string, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    setActiveHeaderMenu(activeHeaderMenu === menuName ? null : menuName)
  }

  const openViewContextWithAnchor = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    setShowViewContext(!showViewContext)
  }



  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setShowViewContext(false)
        setActiveHeaderMenu(null)
        setShowViewOptionsMenu(false)
      }
    }

    const handleWindowResize = () => {
      const activeEl = document.activeElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return
      }
      // On desktop window resize, close popovers to recalculate coordinates
      if (!isMobile) {
        setActiveHeaderMenu(null)
        setShowViewContext(false)
        setShowViewOptionsMenu(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleWindowResize)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [isMobile])


  const getI18n = (key: string, fallback: string) => {
    const val = t(key)
    return val && val !== key ? val : fallback
  }

  const getViewIcon = (type: string, props: any) => {
    switch (type) {
      case 'kanban': return <Kanban {...props} />
      case 'gallery': return <LayoutTemplate {...props} />
      case 'calendar': return <Calendar {...props} />
      case 'timeline': return <Clock {...props} />
      case 'form': return <FormInput {...props} />
      case 'grid':
      default: return <LayoutGrid {...props} />
    }
  }

  return (
    <>
      {isMobile ? (
        /* Mobile Bottom Scrollable Toolbar Dock (< 768px) */
        <nav
          className="mobile-bottom-toolbar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: 'calc(54px + env(safe-area-inset-bottom))',
            paddingBottom: 'env(safe-area-inset-bottom)',
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: '1px solid #e2e8f0',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '4px',
            padding: '0 8px env(safe-area-inset-bottom) 8px',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            zIndex: 99999999,
            boxSizing: 'border-box',
          }}
        >
          {/* 1. 視圖 (Views) */}
          <button
            type="button"
            onClick={openViewContextWithAnchor}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: showViewContext ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: showViewContext ? '#3F6212' : '#64748b',
              flexShrink: 0,
              minWidth: '54px',
              transition: 'all 0.15s ease'
            }}
          >
            {getViewIcon(views.find(v => v.id === activeViewId)?.type || 'grid', { size: 18, color: showViewContext ? '#3F6212' : '#64748b' })}
            <span style={{ fontSize: '11px', fontWeight: showViewContext ? 700 : 500, color: showViewContext ? '#3F6212' : '#475569', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {views.find(v => v.id === activeViewId)?.name || getI18n('toolbar.views', '視圖')}
            </span>
          </button>

          {/* 2. 篩選 (Filter) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('filter', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Filter size={18} color={filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#3F6212' : '#64748b'} />
              {filterRules.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-8px', minWidth: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#3F6212', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                  {filterRules.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: filterRules.length > 0 || activeHeaderMenu === 'filter' ? 700 : 500, color: filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.filter', '篩選')}
            </span>
          </button>

          {/* 3. 排序 (Sort) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('sort', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <ArrowDownAZ size={18} color={activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#3F6212' : '#64748b'} />
              {activeSortRules.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-8px', minWidth: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#3F6212', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                  {activeSortRules.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? 700 : 500, color: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.sort', '排序')}
            </span>
          </button>

          {/* 4. 色彩標記 (Color) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('color', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Palette size={18} color={safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#3F6212' : '#64748b'} />
              {safeRowColorRules.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-8px', minWidth: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#3F6212', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                  {safeRowColorRules.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? 700 : 500, color: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.color', '色彩')}
            </span>
          </button>

          {/* 5. 分組 (Group) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('group', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Layers size={18} color={activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#3F6212' : '#64748b'} />
              {activeGroupByRules.length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-8px', minWidth: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#3F6212', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                  {activeGroupByRules.length}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? 700 : 500, color: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.group', '分組')}
            </span>
          </button>

          {/* 6. 隱藏欄位 (Fields) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('hide', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '56px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <EyeOff size={18} color={actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#3F6212' : '#64748b'} />
              {actualHiddenCount > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-8px', minWidth: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#3F6212', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
                  {actualHiddenCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? 700 : 500, color: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.hideFields', '隱藏欄位')}
            </span>
          </button>

          {/* 7. 列高 (Row Height) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('rowHeight', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#3F6212' : '#64748b',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <AlignJustify size={18} color={rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#3F6212' : '#64748b'} />
            <span style={{ fontSize: '11px', fontWeight: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? 700 : 500, color: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.rowHeight', '列高')}
            </span>
          </button>

          {/* 8. 搜尋 (Search) */}
          <button
            type="button"
            onClick={(e) => openMenuWithAnchor('search', e)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: searchQuery || activeHeaderMenu === 'search' ? '#f0fdf4' : 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              gap: '2px',
              color: searchQuery || activeHeaderMenu === 'search' ? '#3F6212' : '#64748b',
              position: 'relative',
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={18} color={searchQuery || activeHeaderMenu === 'search' ? '#3F6212' : '#64748b'} />
              {searchQuery && (
                <span style={{ position: 'absolute', top: '-2px', right: '-4px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3F6212' }} />
              )}
            </div>
            <span style={{ fontSize: '11px', fontWeight: searchQuery || activeHeaderMenu === 'search' ? 700 : 500, color: searchQuery || activeHeaderMenu === 'search' ? '#3F6212' : '#475569', whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.search', '搜尋')}
            </span>
          </button>

          {/* 9. 復原 (Undo) */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: canUndo ? 'pointer' : 'not-allowed',
              gap: '2px',
              color: canUndo ? '#475569' : '#cbd5e1',
              opacity: canUndo ? 1 : 0.45,
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <Undo2 size={18} />
            <span style={{ fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.undo', '復原')}
            </span>
          </button>

          {/* 10. 重做 (Redo) */}
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: canRedo ? 'pointer' : 'not-allowed',
              gap: '2px',
              color: canRedo ? '#475569' : '#cbd5e1',
              opacity: canRedo ? 1 : 0.45,
              flexShrink: 0,
              minWidth: '52px',
              transition: 'all 0.15s ease'
            }}
          >
            <Redo2 size={18} />
            <span style={{ fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {getI18n('toolbar.redo', '重做')}
            </span>
          </button>

          {/* 11. 匯出 CSV */}
          {handleExportCSV && (
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 8px',
                cursor: 'pointer',
                gap: '2px',
                color: '#475569',
                flexShrink: 0,
                minWidth: '56px',
                transition: 'all 0.15s ease'
              }}
            >
              <Download size={18} />
              <span style={{ fontSize: '11px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {getI18n('toolbar.exportCSV', '匯出 CSV')}
              </span>
            </button>
          )}
        </nav>
      ) : (
        /* Desktop Top Header Toolbar (>= 768px) */
        <header className="layout__col-2-1 header" ref={headerToolbarRef} style={{ height: '52px', minHeight: '52px', maxHeight: '52px', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', boxSizing: 'border-box', zIndex: 1000, overflowX: 'auto', overflowY: 'visible' }}>
          <ul className="header__filter" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <li ref={viewContextRef} className="header__filter-item header__filter-item--grids" style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <a 
                className="header__filter-link active" 
                data-highlight="views"
                onClick={openViewContextWithAnchor}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {getViewIcon(views.find(v => v.id === activeViewId)?.type || 'grid', { size: 16, color: '#64748b', className: 'header__filter-icon' })}
                <span className="header__filter-name header__filter-name--forced">
                  {views.find(v => v.id === activeViewId)?.name || t('toolbar.unnamedView')}
                </span>
                <ChevronDown size={14} color="#64748b" className="header__sub-icon" style={{ marginLeft: '4px' }} />
              </a>
            </li>

            {/* Filter Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${filterRules.length > 0 ? 'active' : activeHeaderMenu === 'filter' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('filter', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (filterRules.length === 0 && activeHeaderMenu !== 'filter') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (filterRules.length === 0 && activeHeaderMenu !== 'filter') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Filter size={16} color={filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: filterRules.length > 0 || activeHeaderMenu === 'filter' ? '#3F6212' : '#44403C', fontWeight: filterRules.length > 0 || activeHeaderMenu === 'filter' ? 600 : 500 }}>
                  {filterRules.length > 0 ? `${filterRules.length} ${t('toolbar.filter')}` : t('toolbar.filter')}
                </span>
              </a>
            </li>

            {/* Sort Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${activeSortRules.length > 0 ? 'active' : activeHeaderMenu === 'sort' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('sort', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeSortRules.length === 0 && activeHeaderMenu !== 'sort') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (activeSortRules.length === 0 && activeHeaderMenu !== 'sort') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ArrowDownAZ size={16} color={activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? '#3F6212' : '#44403C', fontWeight: activeSortRules.length > 0 || activeHeaderMenu === 'sort' ? 600 : 500 }}>
                  {activeSortRules.length > 0 ? `${activeSortRules.length} ${t('toolbar.sort')}` : t('toolbar.sort')}
                </span>
              </a>
            </li>

            {/* Color Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${safeRowColorRules.length > 0 ? 'active' : activeHeaderMenu === 'color' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('color', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (safeRowColorRules.length === 0 && activeHeaderMenu !== 'color') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (safeRowColorRules.length === 0 && activeHeaderMenu !== 'color') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Palette size={16} color={safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? '#3F6212' : '#44403C', fontWeight: safeRowColorRules.length > 0 || activeHeaderMenu === 'color' ? 600 : 500 }}>
                  {safeRowColorRules.length > 0 ? `${safeRowColorRules.length} ${t('toolbar.color')}` : t('toolbar.color')}
                </span>
              </a>
            </li>

            {/* Group Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${activeGroupByRules.length > 0 ? 'active' : activeHeaderMenu === 'group' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('group', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeGroupByRules.length === 0 && activeHeaderMenu !== 'group') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (activeGroupByRules.length === 0 && activeHeaderMenu !== 'group') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Layers size={16} color={activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? '#3F6212' : '#44403C', fontWeight: activeGroupByRules.length > 0 || activeHeaderMenu === 'group' ? 600 : 500 }}>
                  {activeGroupByRules.length > 0 ? `${activeGroupByRules.length} ${t('toolbar.group')}` : t('toolbar.group')}
                </span>
              </a>
            </li>
          </ul>
          
          <ul className="header__filter header__filter--full-width">
            {/* Hide Fields Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${actualHiddenCount > 0 ? 'active' : activeHeaderMenu === 'hide' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('hide', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (actualHiddenCount === 0 && activeHeaderMenu !== 'hide') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (actualHiddenCount === 0 && activeHeaderMenu !== 'hide') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <EyeOff size={16} color={actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? '#3F6212' : '#44403C', fontWeight: actualHiddenCount > 0 || activeHeaderMenu === 'hide' ? 600 : 500 }}>
                  {actualHiddenCount > 0 ? `${actualHiddenCount} ${t('toolbar.hideFields')}` : t('toolbar.hideFields')}
                </span>
              </a>
            </li>
            
            {/* Row Height Button */}
            <li className="header__filter-item" style={{ position: 'relative' }}>
              <a 
                className={`header__filter-link ${rowHeightSize !== 'small' ? 'active' : activeHeaderMenu === 'rowHeight' ? 'active' : ''}`}
                onClick={(e) => openMenuWithAnchor('rowHeight', e)}
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  height: '32px',
                  backgroundColor: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#F4F4F5' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 12px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (rowHeightSize === 'small' && activeHeaderMenu !== 'rowHeight') e.currentTarget.style.backgroundColor = '#F4F4F5';
                }}
                onMouseLeave={(e) => {
                  if (rowHeightSize === 'small' && activeHeaderMenu !== 'rowHeight') e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <AlignJustify size={16} color={rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#3F6212' : '#78716C'} className="header__filter-icon" />
                <span className="header__filter-name" style={{ color: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? '#3F6212' : '#44403C', fontWeight: rowHeightSize !== 'small' || activeHeaderMenu === 'rowHeight' ? 600 : 500 }}>
                  {t('toolbar.rowHeight')}
                </span>
              </a>
            </li>

            {/* Undo & Redo History Quick Action Buttons */}
            <li className="header__filter-item" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                title={t('toolbar.undoTooltip')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: canUndo ? 'pointer' : 'not-allowed',
                  opacity: canUndo ? 1 : 0.4,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <Undo2 size={15} />
                <span>{t('toolbar.undo')}</span>
              </button>

              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                title={t('toolbar.redoTooltip')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '5px 8px',
                  borderRadius: '6px',
                  cursor: canRedo ? 'pointer' : 'not-allowed',
                  opacity: canRedo ? 1 : 0.4,
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.backgroundColor = '#f1f5f9' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <Redo2 size={15} />
                <span>{t('toolbar.redo')}</span>
              </button>
            </li>

            <li className="header__filter-item header__filter-item--right">
              <div className="header__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', color: '#64748b', pointerEvents: 'none' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="soft-input"
                  placeholder={t('toolbar.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ 
                    width: searchQuery ? '240px' : '200px', 
                    padding: '7px 28px 7px 32px', 
                    borderRadius: '10px', 
                    border: '1px solid #cbd5e1', 
                    fontSize: '13px', 
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    outline: 'none',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.05)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3F6212';
                    e.currentTarget.style.boxShadow = '0 0 0 3.5px rgba(63, 98, 18,0.14)';
                    e.currentTarget.style.width = '240px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.05)';
                    if (!searchQuery) e.currentTarget.style.width = '200px';
                  }}
                />
                {searchQuery ? (
                  <span 
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      borderRadius: '50%',
                      transition: 'color 0.15s, background-color 0.15s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fef2f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    title={t('toolbar.clearSearch')}
                  >
                    <X size={13} />
                  </span>
                ) : (
                  <span style={{ position: 'absolute', right: '8px', fontSize: '10px', color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '1px 4px', pointerEvents: 'none', fontWeight: 600 }}>
                    ⌘K
                  </span>
                )}
              </div>
            </li>

            <li className="header__filter-item" style={{ position: 'relative', marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
              <LangPicker align="right" variant="toolbar" />
            </li>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVImport}
            />
          </ul>
        </header>
      )}

      {/* View Switcher Bottom Sheet / Popover Portal */}
      {showViewContext && (isMobile || menuAnchorRect) && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: isMobile ? 'calc(54px + env(safe-area-inset-bottom))' : 0,
            zIndex: 99999990,
            backgroundColor: isMobile ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
            backdropFilter: isMobile ? 'blur(4px)' : 'none',
            display: isMobile ? 'flex' : 'block',
            alignItems: isMobile ? 'flex-end' : undefined,
            justifyContent: isMobile ? 'center' : undefined,
            padding: isMobile ? '0 10px 8px 10px' : 0,
            pointerEvents: 'auto',
            animation: isMobile ? 'backdropFadeIn 0.2s ease' : 'none',
          }}
          onClick={() => setShowViewContext(false)}
        >
          <div 
            style={{ 
              position: isMobile ? 'relative' : 'fixed', 
              top: isMobile ? undefined : `${(menuAnchorRect?.top || 0) + (menuAnchorRect?.height || 0) + 6}px`, 
              left: isMobile ? undefined : `${Math.max(8, Math.min(menuAnchorRect?.left || 8, (typeof window !== 'undefined' ? window.innerWidth : 800) - 250))}px`, 
              width: isMobile ? '100%' : undefined,
              minWidth: isMobile ? '100%' : '240px', 
              maxWidth: isMobile ? '100%' : '90vw',
              maxHeight: isMobile ? 'calc(100vh - 54px - env(safe-area-inset-bottom) - 48px)' : 'calc(100vh - 100px)',
              zIndex: 99999995, 
              background: '#fff', 
              boxShadow: isMobile ? '0 12px 36px -4px rgba(15, 23, 42, 0.28), 0 2px 10px rgba(0, 0, 0, 0.08)' : '0 16px 36px -8px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(0,0,0,0.04)', 
              borderRadius: isMobile ? '18px' : '12px', 
              border: isMobile ? '1px solid rgba(226, 232, 240, 0.9)' : '1px solid #e2e8f0', 
              padding: isMobile ? '14px 16px 16px 16px' : '0', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: isMobile ? 'bottomSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '9999px', backgroundColor: '#cbd5e1', marginBottom: '10px' }} />
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    {t('toolbar.views') || '切換視圖'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowViewContext(false)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '9999px',
                      width: '28px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}
            <div className="select__items" style={{ padding: '6px 0', maxHeight: isMobile ? '50vh' : '300px', overflowY: 'auto' }}>
              <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {views.map(view => (
                  <li key={view.id} style={{ display: 'flex', alignItems: 'center', paddingRight: '6px' }}>
                    <a
                      className={`select__item ${activeViewId === view.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveViewId(view.id)
                        applyViewConfig(view)
                        setShowViewContext(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: isMobile ? '10px 12px' : '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        color: '#1e293b',
                        fontSize: '13px',
                        flex: 1,
                        backgroundColor: activeViewId === view.id ? '#f0fdf4' : 'transparent',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {getViewIcon(view.type || 'grid', { size: 16, color: activeViewId === view.id ? '#3F6212' : '#64748b', style: { marginRight: '10px', flexShrink: 0 } })}
                      <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#3F6212' : 'inherit', fontWeight: activeViewId === view.id ? 700 : 500 }}>{view.name}</span>
                      {activeViewId === view.id && (
                        <Check size={16} color="#3F6212" style={{ flexShrink: 0, marginLeft: '8px', marginRight: '4px' }} />
                      )}
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = e.currentTarget.getBoundingClientRect()
                        setMenuAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
                        setShowViewContext(false)
                        setSelectedViewForMenu(view)
                        setShowViewOptionsMenu(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {canManageStructure && (
              <div className="select__footer" style={{ borderTop: '1px solid #e2e8f0', padding: '6px 0 0 0', marginTop: '4px' }}>
                <a 
                  className="select__footer-button" 
                  onClick={() => {
                    setShowViewContext(false)
                    setShowNewViewModal(true)
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'center' : 'flex-start', padding: isMobile ? '10px 12px' : '8px 12px', borderRadius: '8px', cursor: 'pointer', color: '#3F6212', backgroundColor: isMobile ? '#f0fdf4' : 'transparent', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s ease' }}
                >
                  <Plus size={15} style={{ marginRight: '8px' }} />
                  {t('toolbar.addView') || '新增視圖'}
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* View Options Context Menu */}
      {showViewOptionsMenu && selectedViewForMenu && (
        <ViewContextMenu
          view={selectedViewForMenu}
          x={menuAnchorRect ? Math.min(menuAnchorRect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - 220) : 16}
          y={menuAnchorRect ? menuAnchorRect.top + menuAnchorRect.height + 4 : 60}
          onClose={() => {
            setShowViewOptionsMenu(false)
            setSelectedViewForMenu(null)
          }}
          onExportView={handleExportCSV}
          onImportFile={() => csvInputRef.current?.click()}
          onDuplicateView={onDuplicateView ? () => onDuplicateView(selectedViewForMenu.id) : undefined}
          onRenameView={onRenameView ? () => onRenameView(selectedViewForMenu.id) : undefined}
          onDeleteView={onDeleteView ? () => onDeleteView(selectedViewForMenu.id) : undefined}
        />
      )}

      {/* Top-Layer Floating Portal for Toolbar Menus (Prevents any overflow clipping across all viewports) */}
      {activeHeaderMenu && (isMobile || menuAnchorRect) && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: isMobile ? 'calc(54px + env(safe-area-inset-bottom))' : 0,
            zIndex: 99999990,
            backgroundColor: isMobile ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
            backdropFilter: isMobile ? 'blur(4px)' : 'none',
            display: isMobile ? 'flex' : 'block',
            alignItems: isMobile ? 'flex-end' : undefined,
            justifyContent: isMobile ? 'center' : undefined,
            padding: isMobile ? '0 10px 8px 10px' : 0,
            pointerEvents: 'auto',
            animation: isMobile ? 'backdropFadeIn 0.2s ease' : 'none',
          }}
          onClick={() => setActiveHeaderMenu(null)}
        >
          <style>{`
            @keyframes bottomSheetSlideUp {
              from { transform: translateY(100%); }
              to { transform: translateY(0); }
            }
            @keyframes backdropFadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          <div
            ref={popoverMenuRef}
            className="toolbar-popover-card"
            data-portal-root="true"
            style={{
              position: isMobile ? 'relative' : 'fixed',
              top: isMobile ? undefined : `${(menuAnchorRect?.top || 0) + (menuAnchorRect?.height || 0) + 6}px`,
              left: isMobile ? undefined : `${Math.max(8, Math.min(menuAnchorRect?.left || 8, (typeof window !== 'undefined' ? window.innerWidth : 800) - (activeHeaderMenu === 'filter' || activeHeaderMenu === 'color' ? 540 : activeHeaderMenu === 'sort' || activeHeaderMenu === 'group' ? 490 : 290)))}px`,
              width: isMobile ? '100%' : undefined,
              maxWidth: isMobile ? '100%' : '92vw',
              maxHeight: isMobile ? 'calc(100vh - 54px - env(safe-area-inset-bottom) - 48px)' : 'calc(100vh - 100px)',
              zIndex: 99999995,
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '18px' : '10px',
              boxShadow: isMobile ? '0 12px 36px -4px rgba(15, 23, 42, 0.28), 0 2px 10px rgba(0, 0, 0, 0.08)' : '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
              border: isMobile ? '1px solid rgba(226, 232, 240, 0.9)' : '1px solid #e2e8f0',
              padding: isMobile ? '14px 16px 16px 16px' : (activeHeaderMenu === 'hide' || activeHeaderMenu === 'rowHeight' ? '6px' : '12px'),
              overflowY: 'auto',
              overflowX: 'hidden',
              animation: isMobile ? 'bottomSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Bottom Sheet Grab Handle & Header */}
            {isMobile && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '4px', borderRadius: '9999px', backgroundColor: '#cbd5e1', marginBottom: '10px' }} />
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    {activeHeaderMenu === 'filter' && getI18n('toolbar.filter', '篩選條件')}
                    {activeHeaderMenu === 'sort' && getI18n('toolbar.sort', '排序條件')}
                    {activeHeaderMenu === 'group' && getI18n('toolbar.group', '分組條件')}
                    {activeHeaderMenu === 'color' && getI18n('toolbar.color', '色彩標記')}
                    {activeHeaderMenu === 'hide' && getI18n('toolbar.hideFields', '隱藏欄位')}
                    {activeHeaderMenu === 'rowHeight' && getI18n('toolbar.rowHeight', '列高設定')}
                    {activeHeaderMenu === 'search' && getI18n('toolbar.search', '搜尋表格')}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderMenu(null)}
                      style={{
                        background: '#3F6212',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      {getI18n('common.done', '完成')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHeaderMenu(null)}
                      style={{
                        background: '#f1f5f9',
                        border: 'none',
                        borderRadius: '9999px',
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Filter Content */}
            {activeHeaderMenu === 'filter' && (
              <FilterMenu
                fields={fields}
                filterRules={filterRules}
                setFilterRules={setFilterRules}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            )}

            {/* Sort Content */}
            {activeHeaderMenu === 'sort' && (
              <SortMenu
                fields={fields}
                sortRules={activeSortRules}
                setSortRules={handleSetSortRules}
              />
            )}

            {/* Color Content */}
            {activeHeaderMenu === 'color' && (
              <ColorMenu
                fields={fields}
                rowColorRules={rowColorRules}
                setRowColorRules={setRowColorRules}
                activeViewId={activeViewId}
                saveViewConfig={saveViewConfig}
              />
            )}

            {/* Group Content */}
            {activeHeaderMenu === 'group' && (
              <GroupMenu
                fields={fields}
                groupByRules={activeGroupByRules}
                setGroupByRules={handleSetGroupByRules}
                onCollapseAll={(collapse) => onToggleCollapseAllGroups?.(collapse)}
              />
            )}

            {/* Hide Fields Content */}
            {activeHeaderMenu === 'hide' && (
              <div className="hidings" style={{ width: isMobile ? '100%' : '320px', maxWidth: '100%', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="hidings__head" style={{ padding: '2px 0 8px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="hidings__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} className="hidings__search-icon" style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder={getI18n('hideFields.searchFields', '搜尋欄位名稱...')}
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="hidings__search-input"
                      style={{ width: '100%', height: '36px', padding: '0 10px 0 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  {/* Show All / Hide All Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setHiddenFieldKeys([])
                        if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify([]) })
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#3F6212',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {getI18n('hideFields.showAll', '全部顯示')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = fields.filter((_, idx) => idx > 0).map(f => `field_${f.id}`)
                        setHiddenFieldKeys(allKeys)
                        if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(allKeys) })
                      }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#64748b',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      {getI18n('hideFields.hideAll', '全部隱藏')}
                    </button>
                  </div>
                </div>
                <div className="hidings__body" style={{ maxHeight: isMobile ? '55vh' : '280px', overflowY: 'auto', overflowX: 'hidden', padding: '2px 0' }}>
                  <ul className="hidings__list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredFieldsForHide.map((field) => {
                      const isPrimary = fields.length > 0 && fields[0].id === field.id
                      const key = `field_${field.id}`
                      const isHidden = hiddenFieldKeys.includes(key) || hiddenFieldKeys.includes(String(field.id))
                      return (
                        <li
                          key={field.id}
                          className="hidings__item"
                          onClick={() => {
                            if (isPrimary) return
                            const newHidden = isHidden
                              ? hiddenFieldKeys.filter(k => k !== key && k !== String(field.id))
                              : [...hiddenFieldKeys, key]
                            setHiddenFieldKeys(newHidden)
                            if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(newHidden) })
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            minHeight: '38px',
                            borderRadius: '8px',
                            cursor: isPrimary ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            backgroundColor: isHidden ? 'transparent' : '#f8fafc',
                            border: isHidden ? '1px solid transparent' : '1px solid #f1f5f9',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isHidden ? 'transparent' : '#f8fafc')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: isHidden ? '#94a3b8' : '#3F6212', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              {getFieldIcon(field.type)}
                            </span>
                            <span style={{ color: isHidden ? '#94a3b8' : '#1e293b', fontWeight: isHidden ? 400 : 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {field.name}
                            </span>
                            {isPrimary && (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 600, flexShrink: 0 }}>
                                Primary
                              </span>
                            )}
                          </div>
                          {/* Modern toggle badge */}
                          <div
                            style={{
                              width: '34px',
                              height: '20px',
                              borderRadius: '10px',
                              backgroundColor: !isHidden ? '#3F6212' : '#cbd5e1',
                              position: 'relative',
                              transition: 'background-color 0.2s ease',
                              flexShrink: 0,
                              marginLeft: '8px',
                              opacity: isPrimary ? 0.7 : 1,
                            }}
                          >
                            <div
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '8px',
                                backgroundColor: '#ffffff',
                                position: 'absolute',
                                top: '2px',
                                left: !isHidden ? '16px' : '2px',
                                transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                              }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* Row Height Content */}
            {activeHeaderMenu === 'rowHeight' && (
              <ul style={{ listStyle: 'none', margin: 0, padding: '2px', width: isMobile ? '100%' : '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[
                  { id: 'small', label: 'Small', icon: <AlignJustify size={14} /> },
                  { id: 'medium', label: 'Medium', icon: <AlignJustify size={16} /> },
                  { id: 'large', label: 'Large', icon: <AlignJustify size={18} /> },
                  { id: 'extra', label: 'Extra', icon: <AlignJustify size={20} /> }
                ].map((option) => {
                  const isSelected = rowHeightSize === option.id
                  return (
                    <li key={option.id}>
                      <div
                        onClick={() => {
                          setRowHeightSize(option.id as any)
                          setActiveHeaderMenu(null)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#F4F4F5' : 'transparent',
                          color: isSelected ? '#3F6212' : '#1e293b',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: isSelected ? '#3F6212' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            {option.icon}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500 }}>
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check size={15} color="#3F6212" style={{ flexShrink: 0 }} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Search Content */}
            {activeHeaderMenu === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: isMobile ? '100%' : '320px', padding: '4px 0' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', color: '#64748b', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    autoFocus
                    placeholder={getI18n('toolbar.searchPlaceholder', '搜尋此表格內容...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 36px 0 38px',
                      borderRadius: '12px',
                      border: '1.5px solid #3F6212',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                {searchQuery ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                    已篩選含有「<strong style={{ color: '#3F6212' }}>{searchQuery}</strong>」的資料列
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                    輸入文字即可即時過濾表格所有欄位
                  </p>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
