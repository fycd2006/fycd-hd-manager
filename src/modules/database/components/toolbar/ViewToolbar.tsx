import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeft, PanelLeftClose, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, Search, AlignJustify, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, X, MoreVertical, GripVertical, Trash2, Undo2, Redo2 } from 'lucide-react'
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
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
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
    const handleScrollOrResize = (e: Event) => {
      // Do not close popup menu if scrolling inside popover menu itself (desktop or mobile)
      if (e.type === 'scroll' && e.target) {
        const targetNode = e.target as Node
        const targetEl = e.target as HTMLElement
        if (
          (popoverMenuRef.current && popoverMenuRef.current.contains(targetNode)) ||
          (targetEl.closest && (
            targetEl.closest('.toolbar-popover-card') ||
            targetEl.closest('.custom-select-dropdown') ||
            targetEl.closest('.custom-select-portal-root') ||
            targetEl.closest('[data-portal-root="true"]') ||
            targetEl.closest('.groupings') ||
            targetEl.closest('.header__filter-popover')
          ))
        ) {
          return
        }
      }

      // Ignore resize events when user is typing in an input/textarea (e.g. mobile soft keyboard popup)
      if (e.type === 'resize') {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
          return
        }
      }

      setActiveHeaderMenu(null)
      setShowViewContext(false)
      setShowViewOptionsMenu(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [])


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

          {showViewContext && menuAnchorRect && createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99999998,
                backgroundColor: 'transparent',
                pointerEvents: 'auto'
              }}
              onClick={() => setShowViewContext(false)}
            >
              <div 
                style={{ 
                  position: 'fixed', 
                  top: `${menuAnchorRect.top + menuAnchorRect.height + 6}px`, 
                  left: `${Math.max(8, Math.min(menuAnchorRect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - 250))}px`, 
                  minWidth: '240px', 
                  zIndex: 99999999, 
                  background: '#fff', 
                  boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(0,0,0,0.04)', 
                  borderRadius: '12px', 
                  border: '1px solid #e2e8f0', 
                  padding: '0', 
                  overflow: 'hidden' 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="select__items" style={{ padding: '6px 0', maxHeight: '300px', overflowY: 'auto' }}>
                  <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {views.map(view => (
                      <li key={view.id} style={{ display: 'flex', alignItems: 'center', paddingRight: '6px' }}>
                        <a
                          className={`select__item ${activeViewId === view.id ? 'active' : ''}`}
                          onClick={() => {
                            setActiveViewId(view.id)
                            applyViewConfig(view)
                            setShowViewContext(false)
                          }}
                          style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', textDecoration: 'none', color: '#1e293b', fontSize: '13px', flex: 1, transition: 'background-color 0.15s ease' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {getViewIcon(view.type || 'grid', { size: 14, color: activeViewId === view.id ? '#3F6212' : '#64748b', style: { marginRight: '8px', flexShrink: 0 } })}
                          <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#3F6212' : 'inherit', fontWeight: activeViewId === view.id ? 600 : 400 }}>{view.name}</span>
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
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#94a3b8',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e2e8f0'
                            e.currentTarget.style.color = '#334155'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = '#94a3b8'
                          }}
                          title={t('toolbar.viewOptions')}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {canManageStructure && (
                  <div className="select__footer" style={{ borderTop: '1px solid #e2e8f0', padding: '4px 0' }}>
                    <a 
                      className="select__footer-button" 
                      onClick={() => {
                        setShowViewContext(false)
                        setShowNewViewModal(true)
                      }}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#3F6212' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b' }}
                    >
                      <Plus size={14} style={{ marginRight: '8px' }} />
                      {t('toolbar.addView')}
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

      {/* Top-Layer Floating Portal for Toolbar Menus (Prevents any overflow clipping across all viewports) */}
      {activeHeaderMenu && (isMobile || menuAnchorRect) && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999998,
            backgroundColor: isMobile ? 'rgba(15, 23, 42, 0.45)' : 'transparent',
            backdropFilter: isMobile ? 'blur(3px)' : 'none',
            display: isMobile ? 'flex' : 'block',
            alignItems: isMobile ? 'center' : undefined,
            justifyContent: isMobile ? 'center' : undefined,
            padding: isMobile ? '16px' : 0,
            pointerEvents: 'auto'
          }}
          onClick={() => setActiveHeaderMenu(null)}
        >
          <div
            ref={popoverMenuRef}
            className="toolbar-popover-card"
            data-portal-root="true"
            style={{
              position: isMobile ? 'relative' : 'fixed',
              top: isMobile ? undefined : `${(menuAnchorRect?.top || 0) + (menuAnchorRect?.height || 0) + 6}px`,
              left: isMobile ? undefined : `${Math.max(8, Math.min(menuAnchorRect?.left || 8, (typeof window !== 'undefined' ? window.innerWidth : 800) - (activeHeaderMenu === 'filter' || activeHeaderMenu === 'color' ? 540 : activeHeaderMenu === 'sort' || activeHeaderMenu === 'group' ? 490 : 290)))}px`,
              zIndex: 99999999,
              backgroundColor: '#ffffff',
              borderRadius: isMobile ? '16px' : '10px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              padding: activeHeaderMenu === 'hide' || activeHeaderMenu === 'rowHeight' ? '6px' : '12px',
              maxWidth: isMobile ? '100%' : '92vw',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filter Content */}
            {activeHeaderMenu === 'filter' && (
              <FilterMenu
                fields={fields}
                filterRules={filterRules}
                setFilterRules={setFilterRules}
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
              <div className="hidings" style={{ width: '300px', maxWidth: '90vw', overflowX: 'hidden', overflowY: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="hidings__head" style={{ padding: '2px 0 6px 0', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="hidings__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} className="hidings__search-icon" style={{ position: 'absolute', left: '8px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder={t('hideFields.searchFields') || "Search fields"}
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="hidings__search-input"
                      style={{ width: '100%', padding: '6px 8px 6px 30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  {/* Show All / Hide All Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
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
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {t('hideFields.showAll') || '全部顯示'}
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
                        padding: '2px 6px',
                        borderRadius: '4px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      {t('hideFields.hideAll') || '全部隱藏'}
                    </button>
                  </div>
                </div>
                <div className="hidings__body" style={{ maxHeight: '240px', overflowY: 'auto', overflowX: 'hidden', padding: '2px 0' }}>
                  <ul className="hidings__list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                            padding: '6px 8px',
                            borderRadius: '6px',
                            cursor: isPrimary ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            backgroundColor: isHidden ? 'transparent' : '#ffffff',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: isHidden ? '#94a3b8' : '#3F6212', display: 'flex', alignItems: 'center' }}>
                              {getFieldIcon(field.type)}
                            </span>
                            <span style={{ color: isHidden ? '#94a3b8' : '#1e293b', fontWeight: isHidden ? 400 : 500 }}>
                              {field.name}
                            </span>
                            {isPrimary && (
                              <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
                                Primary
                              </span>
                            )}
                          </div>
                          {/* Modern toggle badge */}
                          <div
                            style={{
                              width: '32px',
                              height: '18px',
                              borderRadius: '9px',
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
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: '#ffffff',
                                position: 'absolute',
                                top: '2px',
                                left: !isHidden ? '16px' : '2px',
                                transition: 'left 0.2s ease',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
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
              <ul style={{ listStyle: 'none', margin: 0, padding: '2px', width: '180px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#F4F4F5' : 'transparent',
                          color: isSelected ? '#3F6212' : '#1e293b',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: isSelected ? '#3F6212' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            {option.icon}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>
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
          </div>
        </div>,
        document.body
      )}

      {/* Desktop Top-Layer View Context Menu */}
      {!isMobile && showViewContext && menuAnchorRect && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999998,
            backgroundColor: 'transparent',
            pointerEvents: 'auto'
          }}
          onClick={() => setShowViewContext(false)}
        >
          <div
            className="toolbar-popover-card"
            data-portal-root="true"
            style={{
              position: 'fixed',
              top: `${menuAnchorRect.top + menuAnchorRect.height + 6}px`,
              left: `${Math.max(12, Math.min(menuAnchorRect.left, window.innerWidth - 280))}px`,
              zIndex: 99999999,
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              padding: '0',
              minWidth: '240px',
              maxWidth: '300px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="select__items" style={{ padding: '4px 0', maxHeight: '300px', overflowY: 'auto' }}>
              <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {views.map(view => (
                  <li key={view.id} style={{ display: 'flex', alignItems: 'center', paddingRight: '6px' }}>
                    <a
                      className={`select__item ${activeViewId === view.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveViewId(view.id)
                        applyViewConfig(view)
                        setShowViewContext(false)
                      }}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', textDecoration: 'none', color: '#1e293b', fontSize: '13px', flex: 1, transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {getViewIcon(view.type || 'grid', { size: 14, color: activeViewId === view.id ? '#3F6212' : '#64748b', style: { marginRight: '8px', flexShrink: 0 } })}
                      <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#3F6212' : 'inherit', fontWeight: activeViewId === view.id ? 600 : 400 }}>{view.name}</span>
                      {activeViewId === view.id && (
                        <Check size={16} color="#3F6212" style={{ flexShrink: 0, marginLeft: '8px', marginRight: '4px' }} />
                      )}
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowViewContext(false)
                        setSelectedViewForMenu(view)
                        setShowViewOptionsMenu(true)
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9'
                        e.currentTarget.style.color = '#1e293b'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#94a3b8'
                      }}
                      title="視圖選項 (View options)"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {canManageStructure && (
              <div className="select__footer" style={{ borderTop: '1px solid #e2e8f0', padding: '4px 0' }}>
                <a 
                  className="select__footer-button" 
                  onClick={() => {
                    setShowViewContext(false)
                    setShowNewViewModal(true)
                  }}
                  style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#3F6212' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b' }}
                >
                  <Plus size={14} style={{ marginRight: '8px' }} />
                  新增視圖
                </a>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Mobile Top-Layer View Context Menu */}
      {isMobile && showViewContext && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999999,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            pointerEvents: 'auto',
            touchAction: 'manipulation'
          }}
          onClick={() => setShowViewContext(false)}
        >
          <div
            className="toolbar-popover-card"
            data-portal-root="true"
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '80vh',
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
              padding: '20px',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{t('toolbar.switchView')}</h3>
              <button
                type="button"
                onClick={() => setShowViewContext(false)}
                style={{ width: '30px', height: '30px', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {views.map(view => {
                const isSelected = activeViewId === view.id
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      setActiveViewId(view.id)
                      applyViewConfig(view)
                      setShowViewContext(false)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: isSelected ? '#3F6212' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '13px',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                      {getViewIcon(view.type || 'grid', { size: 16, color: isSelected ? '#ffffff' : '#64748b', style: { flexShrink: 0 } })}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.name}</span>
                    </div>
                    {isSelected && <Check size={16} color="#ffffff" style={{ flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>

            {canManageStructure && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewContext(false)
                    setShowNewViewModal(true)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: '#F4F4F5',
                    color: '#18181B',
                    fontWeight: 600,
                    fontSize: '13px',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={16} color="#3F6212" />
                  <span>{t('toolbar.addView')}</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
