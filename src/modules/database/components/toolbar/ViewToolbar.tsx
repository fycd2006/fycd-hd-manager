import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PanelLeft, PanelLeftClose, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, Search, AlignJustify, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, X, MoreVertical, GripVertical, Trash2 } from 'lucide-react'
import type { TableView, TableField, FilterRule, RowColorRule } from '@/modules/database/types'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import { ViewContextMenu } from '@/modules/database/components/menu/ViewContextMenu'

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

  // Filter
  filterRules: FilterRule[]
  setFilterRules: (v: FilterRule[]) => void

  // Color rules
  rowColorRules: RowColorRule[]
  setRowColorRules: (v: RowColorRule[]) => void

  // Group
  groupByField: string | null
  setGroupByField: (v: string | null) => void

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
  filterRules,
  setFilterRules,
  rowColorRules,
  setRowColorRules,
  groupByField,
  setGroupByField,
  fields,
  hiddenFieldKeys,
  setHiddenFieldKeys,
  rowHeightSize,
  setRowHeightSize,
  handleExportCSV,
  handleCSVImport,
  csvInputRef,
  canManageStructure = true
}: ViewToolbarProps) {
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
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
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

  useOnClickOutside(viewContextRef, () => {
    setShowViewContext(false)
  })

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setShowViewContext(false)
        setActiveHeaderMenu(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
              {views.find(v => v.id === activeViewId)?.name || '未命名視圖'}
            </span>
            <ChevronDown size={14} color="#64748b" className="header__sub-icon" />
          </a>

          {/* Active View Context Menu Button (⋮) */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowViewContext(false)
              const currentActiveView = views.find(v => v.id === activeViewId) || views[0]
              setSelectedViewForMenu(showViewOptionsMenu ? null : currentActiveView)
              setShowViewOptionsMenu(!showViewOptionsMenu)
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
              color: '#64748b',
              marginLeft: '2px',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="視圖選項 (View options)"
          >
            <MoreVertical size={16} />
          </button>

          {/* Context Menu Dropdown */}
          {!isMobile && showViewContext && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: '0', minWidth: '240px', zIndex: 99999, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0', overflow: 'hidden' }}>
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
                        {getViewIcon(view.type || 'grid', { size: 14, color: activeViewId === view.id ? '#2563eb' : '#64748b', style: { marginRight: '8px', flexShrink: 0 } })}
                        <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#2563eb' : 'inherit', fontWeight: activeViewId === view.id ? 600 : 400 }}>{view.name}</span>
                        {activeViewId === view.id && (
                          <Check size={16} color="#2563eb" style={{ flexShrink: 0, marginLeft: '8px', marginRight: '4px' }} />
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
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#2563eb' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b' }}
                  >
                    <Plus size={14} style={{ marginRight: '8px' }} />
                    新增視圖
                  </a>
                </div>
              )}
            </div>
          )}

          {/* View Options Context Menu */}
          {showViewOptionsMenu && selectedViewForMenu && (
            <ViewContextMenu
              view={selectedViewForMenu}
              onClose={() => {
                setShowViewOptionsMenu(false)
                setSelectedViewForMenu(null)
              }}
              onConfigureDateDependencies={() => {
                alert(`Setting date dependencies for view ${selectedViewForMenu.name}`)
              }}
              onExportView={handleExportCSV}
              onImportFile={() => csvInputRef.current?.click()}
              onDuplicateView={() => {
                if (onDuplicateView) {
                  onDuplicateView(selectedViewForMenu.id)
                } else {
                  alert(`Duplicating view: ${selectedViewForMenu.name}`)
                }
              }}
              onToPersonal={() => {
                alert(`Toggled personal mode for view ${selectedViewForMenu.name}`)
              }}
              onWebhooks={() => {
                alert(`Webhooks config for view ${selectedViewForMenu.name}`)
              }}
              onDefaultRowValues={() => {
                alert(`Default row values config for view ${selectedViewForMenu.name}`)
              }}
              onRenameView={() => {
                if (onRenameView) {
                  onRenameView(selectedViewForMenu.id)
                }
              }}
              onDeleteView={() => {
                if (onDeleteView) {
                  onDeleteView(selectedViewForMenu.id)
                }
              }}
            />
          )}
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${filterRules.length > 0 ? 'active active--error' : activeHeaderMenu === 'filter' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('filter', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={16} color={filterRules.length > 0 ? '#ef4444' : activeHeaderMenu === 'filter' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">{filterRules.length > 0 ? `${filterRules.length} filter${filterRules.length > 1 ? 's' : ''}` : 'Filter'}</span>
          </a>
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${sortField ? 'active active--error' : activeHeaderMenu === 'sort' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('sort', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowDownAZ size={16} color={sortField ? '#ef4444' : activeHeaderMenu === 'sort' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">{sortField ? '1 sort' : 'Sort'}</span>
          </a>
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${safeRowColorRules.length > 0 ? 'active' : activeHeaderMenu === 'color' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('color', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Palette size={16} color={safeRowColorRules.length > 0 ? '#2563eb' : activeHeaderMenu === 'color' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">{safeRowColorRules.length > 0 ? `${safeRowColorRules.length} colored` : 'Color'}</span>
          </a>
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${groupByField ? 'active' : activeHeaderMenu === 'group' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('group', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={16} color={groupByField || activeHeaderMenu === 'group' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">Group</span>
          </a>
        </li>
      </ul>
      
      <ul className="header__filter header__filter--full-width">
        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${actualHiddenCount > 0 ? 'active active--error' : activeHeaderMenu === 'hide' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('hide', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <EyeOff size={16} color={actualHiddenCount > 0 ? '#ef4444' : activeHeaderMenu === 'hide' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">
              {actualHiddenCount > 0 ? `${actualHiddenCount} hidden` : 'Hide fields'}
            </span>
          </a>
        </li>
        
        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${rowHeightSize !== 'small' ? 'active' : activeHeaderMenu === 'rowHeight' ? 'active' : ''}`}
            onClick={(e) => openMenuWithAnchor('rowHeight', e)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AlignJustify size={16} color={rowHeightSize !== 'small' ? '#2563eb' : activeHeaderMenu === 'rowHeight' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">Row height</span>
          </a>
        </li>

        <li className="header__filter-item header__filter-item--right">
          <div className="header__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b', pointerEvents: 'none' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜尋記錄 (Ctrl+K)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: searchQuery ? '240px' : '200px', 
                padding: '6px 28px 6px 30px', 
                borderRadius: '6px', 
                border: '1px solid #cbd5e1', 
                fontSize: '13px', 
                backgroundColor: '#ffffff',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)';
                e.currentTarget.style.width = '240px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
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
                title="清除搜尋"
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

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleCSVImport}
        />
      </ul>

      {/* Top-Layer Floating Portal for Toolbar Menus (Prevents any overflow clipping across all viewports) */}
      {activeHeaderMenu && menuAnchorRect && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999998,
            backgroundColor: 'transparent',
            pointerEvents: 'auto'
          }}
          onClick={() => setActiveHeaderMenu(null)}
        >
          <div
            style={{
              position: 'fixed',
              top: `${menuAnchorRect.top + menuAnchorRect.height + 6}px`,
              left: `${Math.max(8, Math.min(menuAnchorRect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - (activeHeaderMenu === 'filter' || activeHeaderMenu === 'color' ? 380 : activeHeaderMenu === 'sort' ? 320 : 220)))}px`,
              zIndex: 99999999,
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              padding: activeHeaderMenu === 'hide' || activeHeaderMenu === 'rowHeight' ? '6px' : '12px',
              minWidth: activeHeaderMenu === 'filter' || activeHeaderMenu === 'color' ? '340px' : activeHeaderMenu === 'sort' ? '300px' : '200px',
              maxWidth: '92vw',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filter Content */}
            {activeHeaderMenu === 'filter' && (
              filterRules.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                  此視圖尚未設定任何篩選條件
                  <div style={{ marginTop: '12px' }}>
                    <button 
                      className="button button--secondary button--small"
                      onClick={() => {
                        const newRule = { fieldKey: fields.length > 0 ? `field_${fields[0].id}` : '', operator: 'contains' as const, value: '' };
                        setFilterRules([newRule]);
                      }}
                    >
                      + 新增篩選條件
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filterRules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#64748b', width: '40px' }}>{idx === 0 ? 'Where' : 'And'}</span>
                      <select 
                        value={rule.fieldKey} 
                        onChange={(e) => {
                          const newRules = [...filterRules];
                          newRules[idx].fieldKey = e.target.value;
                          setFilterRules(newRules);
                        }}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1 }}
                      >
                        {fields.map(f => <option key={f.id} value={`field_${f.id}`}>{f.name}</option>)}
                      </select>
                      <select 
                        value={rule.operator} 
                        onChange={(e) => {
                          const newRules = [...filterRules];
                          newRules[idx].operator = e.target.value as any;
                          setFilterRules(newRules);
                        }}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '110px' }}
                      >
                        <option value="contains">包含 (contains)</option>
                        <option value="not_contains">不包含 (not contains)</option>
                        <option value="equals">等於 (equals)</option>
                        <option value="not_equals">不等於 (not equals)</option>
                        <option value="empty">為空 (is empty)</option>
                        <option value="not_empty">不為空 (is not empty)</option>
                      </select>
                      {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
                        <input 
                          type="text" 
                          value={rule.value} 
                          onChange={(e) => {
                            const newRules = [...filterRules];
                            newRules[idx].value = e.target.value;
                            setFilterRules(newRules);
                          }}
                          placeholder="Value"
                          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, minWidth: '80px' }}
                        />
                      )}
                      <button 
                        onClick={() => {
                          const newRules = filterRules.filter((_, i) => i !== idx);
                          setFilterRules(newRules);
                        }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
                        title="刪除條件"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ marginTop: '8px' }}>
                    <button 
                      className="button button--secondary button--small"
                      onClick={() => {
                        const newRule = { fieldKey: fields.length > 0 ? `field_${fields[0].id}` : '', operator: 'contains' as const, value: '' };
                        setFilterRules([...filterRules, newRule]);
                      }}
                      style={{ fontSize: '13px', padding: '4px 8px' }}
                    >
                      + 新增篩選條件
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Sort Content */}
            {activeHeaderMenu === 'sort' && (
              <div className="sortings">
                <div className="sortings__empty" style={{ padding: '4px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  <div style={{ marginBottom: '8px', textAlign: 'left', fontWeight: 600 }}>在此視圖中的記錄將不會被排序</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {fields.map(f => {
                      const key = `field_${f.id}`;
                      const isSelected = sortField === key;
                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            setSortField(isSelected ? null : key);
                            if (activeViewId) saveViewConfig(activeViewId, { sortField: isSelected ? null : key });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                            color: isSelected ? '#2563eb' : '#1e293b',
                            fontWeight: isSelected ? 600 : 400,
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          <span>{f.name}</span>
                          {isSelected && <Check size={14} />}
                        </div>
                      );
                    })}
                  </div>
                  {sortField && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        className={`button button--small ${sortOrder === 'asc' ? 'button--primary' : 'button--secondary'}`}
                        onClick={() => {
                          setSortOrder('asc');
                          if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'asc' });
                        }}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        A-Z
                      </button>
                      <button
                        className={`button button--small ${sortOrder === 'desc' ? 'button--primary' : 'button--secondary'}`}
                        onClick={() => {
                          setSortOrder('desc');
                          if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'desc' });
                        }}
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Z-A
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Color Content */}
            {activeHeaderMenu === 'color' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Row coloring rules</span>
                  {safeRowColorRules.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#2563eb' }}>{safeRowColorRules.length} rules active</span>
                  )}
                </div>
                {safeRowColorRules.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
                    此視圖尚未設定任何色彩塗色條件
                    <div style={{ marginTop: '12px' }}>
                      <button 
                        className="button button--secondary button--small"
                        onClick={() => {
                          const newRule: RowColorRule = {
                            fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                            operator: 'contains',
                            value: '',
                            color: 'blue'
                          };
                          const updated = [...safeRowColorRules, newRule];
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                      >
                        + 新增塗色條件 (Add color rule)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {safeRowColorRules.map((rule, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', width: '40px', fontWeight: 500 }}>{idx === 0 ? 'Where' : 'And'}</span>
                        <select 
                          value={rule.fieldKey} 
                          onChange={(e) => {
                            const updated = [...safeRowColorRules];
                            updated[idx].fieldKey = e.target.value;
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1 }}
                        >
                          {safeFields.map(f => <option key={f.id} value={`field_${f.id}`}>{f.name}</option>)}
                        </select>
                        <select 
                          value={rule.operator} 
                          onChange={(e) => {
                            const updated = [...safeRowColorRules];
                            updated[idx].operator = e.target.value as any;
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '110px' }}
                        >
                          <option value="contains">包含 (contains)</option>
                          <option value="equals">等於 (equals)</option>
                        </select>
                        <input 
                          type="text" 
                          value={rule.value} 
                          placeholder="值 (Value)..."
                          onChange={(e) => {
                            const updated = [...safeRowColorRules];
                            updated[idx].value = e.target.value;
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1 }}
                        />
                        <select
                          value={rule.color}
                          onChange={(e) => {
                            const updated = [...safeRowColorRules];
                            updated[idx].color = e.target.value as any;
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', width: '90px' }}
                        >
                          <option value="red">🔴 紅色</option>
                          <option value="green">🟢 綠色</option>
                          <option value="blue">🔵 藍色</option>
                          <option value="yellow">🟡 黃色</option>
                          <option value="purple">🟣 紫色</option>
                          <option value="orange">🟠 橘色</option>
                        </select>
                        <button 
                          onClick={() => {
                            const updated = safeRowColorRules.filter((_, i) => i !== idx);
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                          title="刪除條件"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button 
                        className="button button--secondary button--small"
                        onClick={() => {
                          const newRule: RowColorRule = {
                            fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                            operator: 'contains',
                            value: '',
                            color: 'blue'
                          };
                          const updated = [...safeRowColorRules, newRule];
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                      >
                        + 新增塗色條件
                      </button>
                      <button
                        className="button button--ghost button--small"
                        onClick={() => {
                          setRowColorRules([]);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: '[]' });
                        }}
                        style={{ color: '#ef4444', fontSize: '12px' }}
                      >
                        清除全部
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Group Content */}
            {activeHeaderMenu === 'group' && (
              <div className="groupings">
                <div className="groupings__head" style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>分組欄位</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                  <div
                    onClick={() => {
                      setGroupByField(null);
                      if (activeViewId) saveViewConfig(activeViewId, { groupByField: null });
                      setActiveHeaderMenu(null);
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: !groupByField ? '#eff6ff' : 'transparent',
                      color: !groupByField ? '#2563eb' : '#64748b',
                      fontWeight: !groupByField ? 600 : 400,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => { if (groupByField) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                    onMouseLeave={(e) => { if (groupByField) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span>(無分組)</span>
                    {!groupByField && <Check size={14} />}
                  </div>
                  {fields.map(f => {
                    const key = `field_${f.id}`;
                    const isSelected = groupByField === key;
                    return (
                      <div
                        key={f.id}
                        onClick={() => {
                          setGroupByField(key);
                          if (activeViewId) saveViewConfig(activeViewId, { groupByField: key });
                          setActiveHeaderMenu(null);
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          fontWeight: isSelected ? 600 : 400,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span>{f.name}</span>
                        {isSelected && <Check size={14} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hide Fields Content */}
            {activeHeaderMenu === 'hide' && (
              <div className="hidings" style={{ width: '100%', overflow: 'hidden' }}>
                <div className="hidings__head" style={{ padding: '6px 0 6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div className="hidings__search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} className="hidings__search-icon" style={{ position: 'absolute', left: '8px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search fields"
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      className="hidings__search-input"
                      style={{ width: '100%', padding: '6px 8px 6px 30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>
                <div className="hidings__body" style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px 0' }}>
                  <ul className="hidings__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {filteredFieldsForHide.map(field => {
                      const key = `field_${field.id}`
                      const isHidden = hiddenFieldKeys.includes(key) || hiddenFieldKeys.includes(String(field.id))
                      return (
                        <li
                          key={field.id}
                          className="hidings__item"
                          onClick={() => {
                            const newHidden = isHidden
                              ? hiddenFieldKeys.filter(k => k !== key && k !== String(field.id))
                              : [...hiddenFieldKeys, key]
                            setHiddenFieldKeys(newHidden)
                            if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(newHidden) })
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {getFieldIcon(field.type)}
                          <span style={{ marginLeft: '8px', flex: 1 }}>{field.name}</span>
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => {}}
                            style={{ cursor: 'pointer' }}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}

            {/* Row Height Content */}
            {activeHeaderMenu === 'rowHeight' && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                          color: isSelected ? '#2563eb' : '#1e293b',
                          transition: 'background-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ color: isSelected ? '#2563eb' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            {option.icon}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400 }}>
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
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
                      {getViewIcon(view.type || 'grid', { size: 14, color: activeViewId === view.id ? '#2563eb' : '#64748b', style: { marginRight: '8px', flexShrink: 0 } })}
                      <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#2563eb' : 'inherit', fontWeight: activeViewId === view.id ? 600 : 400 }}>{view.name}</span>
                      {activeViewId === view.id && (
                        <Check size={16} color="#2563eb" style={{ flexShrink: 0, marginLeft: '8px', marginRight: '4px' }} />
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
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#2563eb' }}
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

      {/* Mobile Top-Layer Portal for Toolbar Menus (Prevents any clipping or overlap) */}
      {isMobile && activeHeaderMenu && createPortal(
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
          onClick={() => setActiveHeaderMenu(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {activeHeaderMenu === 'filter' && '篩選條件 (Filters)'}
                {activeHeaderMenu === 'sort' && '排序設定 (Sorting)'}
                {activeHeaderMenu === 'color' && '色彩塗色 (Row Colors)'}
                {activeHeaderMenu === 'group' && '分組欄位 (Grouping)'}
                {activeHeaderMenu === 'hide' && '隱藏欄位 (Hide Fields)'}
                {activeHeaderMenu === 'rowHeight' && '列高設定 (Row Height)'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveHeaderMenu(null)}
                style={{ width: '30px', height: '30px', borderRadius: '9999px', backgroundColor: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Content */}
            {activeHeaderMenu === 'filter' && (
              filterRules.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                  此視圖尚未設定任何篩選條件
                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newRule = { fieldKey: fields.length > 0 ? `field_${fields[0].id}` : '', operator: 'contains' as const, value: '' };
                        setFilterRules([newRule]);
                      }}
                      style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + 新增篩選條件
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filterRules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{idx === 0 ? 'Where' : 'And'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newRules = filterRules.filter((_, i) => i !== idx);
                            setFilterRules(newRules);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}
                        >
                          刪除
                        </button>
                      </div>
                      <select
                        value={rule.fieldKey}
                        onChange={(e) => {
                          const newRules = [...filterRules];
                          newRules[idx].fieldKey = e.target.value;
                          setFilterRules(newRules);
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        {fields.map(f => <option key={f.id} value={`field_${f.id}`}>{f.name}</option>)}
                      </select>
                      <select
                        value={rule.operator}
                        onChange={(e) => {
                          const newRules = [...filterRules];
                          newRules[idx].operator = e.target.value as any;
                          setFilterRules(newRules);
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="contains">包含 (contains)</option>
                        <option value="not_contains">不包含 (not contains)</option>
                        <option value="equals">等於 (equals)</option>
                        <option value="not_equals">不等於 (not equals)</option>
                        <option value="empty">為空 (is empty)</option>
                        <option value="not_empty">不為空 (is not empty)</option>
                      </select>
                      {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={(e) => {
                            const newRules = [...filterRules];
                            newRules[idx].value = e.target.value;
                            setFilterRules(newRules);
                          }}
                          placeholder="請輸入數值..."
                          style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const newRule = { fieldKey: fields.length > 0 ? `field_${fields[0].id}` : '', operator: 'contains' as const, value: '' };
                      setFilterRules([...filterRules, newRule]);
                    }}
                    style={{ padding: '10px', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginTop: '6px' }}
                  >
                    + 新增條件
                  </button>
                </div>
              )
            )}

            {/* Sort Content */}
            {activeHeaderMenu === 'sort' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>選擇要進行排序的欄位：</div>
                {fields.map(f => {
                  const key = `field_${f.id}`
                  const isSelected = sortField === key
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSortField(isSelected ? null : key)
                        if (activeViewId) saveViewConfig(activeViewId, { sortField: isSelected ? null : key })
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#2563eb' : '#0f172a',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{f.name}</span>
                      {isSelected && <Check size={16} color="#2563eb" />}
                    </div>
                  )
                })}
                {sortField && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('asc')
                        if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'asc' })
                      }}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: sortOrder === 'asc' ? '#2563eb' : '#f1f5f9', color: sortOrder === 'asc' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 600 }}
                    >
                      升冪 (A-Z)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSortOrder('desc')
                        if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'desc' })
                      }}
                      style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: sortOrder === 'desc' ? '#2563eb' : '#f1f5f9', color: sortOrder === 'desc' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 600 }}
                    >
                      降冪 (Z-A)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Color Content */}
            {activeHeaderMenu === 'color' && (
              safeRowColorRules.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '24px 0' }}>
                  此視圖尚未設定任何色彩塗色條件
                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newRule: RowColorRule = {
                          fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                          operator: 'contains',
                          value: '',
                          color: 'blue'
                        };
                        const updated = [...safeRowColorRules, newRule];
                        setRowColorRules(updated);
                        if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                      }}
                      style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + 新增塗色條件
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {safeRowColorRules.map((rule, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>{idx === 0 ? 'Where' : 'And'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = safeRowColorRules.filter((_, i) => i !== idx);
                            setRowColorRules(updated);
                            if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}
                        >
                          刪除
                        </button>
                      </div>
                      <select
                        value={rule.fieldKey}
                        onChange={(e) => {
                          const updated = [...safeRowColorRules];
                          updated[idx].fieldKey = e.target.value;
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        {safeFields.map(f => <option key={f.id} value={`field_${f.id}`}>{f.name}</option>)}
                      </select>
                      <select
                        value={rule.operator}
                        onChange={(e) => {
                          const updated = [...safeRowColorRules];
                          updated[idx].operator = e.target.value as any;
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="contains">包含 (contains)</option>
                        <option value="equals">等於 (equals)</option>
                      </select>
                      <input
                        type="text"
                        value={rule.value}
                        placeholder="值 (Value)..."
                        onChange={(e) => {
                          const updated = [...safeRowColorRules];
                          updated[idx].value = e.target.value;
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                      <select
                        value={rule.color}
                        onChange={(e) => {
                          const updated = [...safeRowColorRules];
                          updated[idx].color = e.target.value as any;
                          setRowColorRules(updated);
                          if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                        }}
                        style={{ padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      >
                        <option value="red">🔴 紅色</option>
                        <option value="green">🟢 綠色</option>
                        <option value="blue">🔵 藍色</option>
                        <option value="yellow">🟡 黃色</option>
                        <option value="purple">🟣 紫色</option>
                        <option value="orange">🟠 橘色</option>
                      </select>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const newRule: RowColorRule = {
                          fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                          operator: 'contains',
                          value: '',
                          color: 'blue'
                        };
                        const updated = [...safeRowColorRules, newRule];
                        setRowColorRules(updated);
                        if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) });
                      }}
                      style={{ padding: '8px 14px', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + 新增塗色條件
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRowColorRules([]);
                        if (activeViewId) saveViewConfig(activeViewId, { rowColors: '[]' });
                      }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      清除全部
                    </button>
                  </div>
                </div>
              )
            )}

            {/* Group Content */}
            {activeHeaderMenu === 'group' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  onClick={() => {
                    setGroupByField(null);
                    if (activeViewId) saveViewConfig(activeViewId, { groupByField: null });
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: !groupByField ? '#eff6ff' : '#f8fafc',
                    color: !groupByField ? '#2563eb' : '#0f172a',
                    fontWeight: !groupByField ? 700 : 500,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>(無分組)</span>
                  {!groupByField && <Check size={16} color="#2563eb" />}
                </div>
                {fields.map(f => {
                  const key = `field_${f.id}`;
                  const isSelected = groupByField === key;
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setGroupByField(key);
                        if (activeViewId) saveViewConfig(activeViewId, { groupByField: key });
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                        color: isSelected ? '#2563eb' : '#0f172a',
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{f.name}</span>
                      {isSelected && <Check size={16} color="#2563eb" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Hide Fields Content */}
            {activeHeaderMenu === 'hide' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {fields.map(f => {
                  const key = `field_${f.id}`
                  const isHidden = hiddenFieldKeys.includes(key) || hiddenFieldKeys.includes(String(f.id))
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        const newHidden = isHidden
                          ? hiddenFieldKeys.filter(k => k !== key && k !== String(f.id))
                          : [...hiddenFieldKeys, key]
                        setHiddenFieldKeys(newHidden)
                        if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(newHidden) })
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        backgroundColor: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '13px',
                        color: isHidden ? '#94a3b8' : '#0f172a',
                        fontWeight: 500
                      }}
                    >
                      <span>{f.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: isHidden ? '#ef4444' : '#10b981' }}>
                        {isHidden ? '已隱藏' : '顯示中'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Row Height Content */}
            {activeHeaderMenu === 'rowHeight' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { id: 'small', label: '緊湊 (Small)' },
                  { id: 'medium', label: '適中 (Medium)' },
                  { id: 'large', label: '寬鬆 (Large)' },
                  { id: 'extra', label: '超寬 (Extra)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setRowHeightSize(opt.id as any)
                      setActiveHeaderMenu(null)
                    }}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: rowHeightSize === opt.id ? '#eff6ff' : '#f8fafc',
                      color: rowHeightSize === opt.id ? '#2563eb' : '#0f172a',
                      fontWeight: rowHeightSize === opt.id ? 700 : 500,
                      fontSize: '13px',
                      border: 'none',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{opt.label}</span>
                    {rowHeightSize === opt.id && <Check size={16} color="#2563eb" />}
                  </button>
                ))}
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
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>切換視圖 (Views)</h3>
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
                      backgroundColor: isSelected ? '#2563eb' : '#f8fafc',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '13px',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>{view.name}</span>
                    {isSelected && <Check size={16} color="#ffffff" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
