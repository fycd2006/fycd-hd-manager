import React, { useRef, useState } from 'react'
import { PanelLeft, PanelLeftClose, ChevronDown, Check, Plus, Filter, ArrowDownAZ, Palette, Layers, EyeOff, Search, AlignJustify, LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput, X } from 'lucide-react'
import type { TableView, TableField, FilterRule } from '@/modules/database/types'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import { Trash2 } from 'lucide-react'

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
  searchQuery,
  setSearchQuery,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  filterRules,
  setFilterRules,
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
  const [showViewContext, setShowViewContext] = useState(false)
  const [activeHeaderMenu, setActiveHeaderMenu] = useState<string | null>(null)

  const headerToolbarRef = useRef<HTMLElement>(null)
  const viewContextRef = useRef<HTMLLIElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useOnClickOutside(viewContextRef, () => setShowViewContext(false))
  useOnClickOutside(headerToolbarRef, () => setActiveHeaderMenu(null))

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
    <header className="layout__col-2-1 header" ref={headerToolbarRef} style={{ height: '52px', minHeight: '52px', maxHeight: '52px', display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', boxSizing: 'border-box', zIndex: 1000, overflow: 'visible' }}>
      <ul className="header__filter">
        {isSidebarCollapsed && (
          <li className="header__filter-item">
            <a
              className="header__filter-link"
              onClick={() => setIsSidebarCollapsed(false)}
              title="展開側邊欄"
              style={{ cursor: 'pointer', padding: '0 10px', display: 'flex', alignItems: 'center', color: '#2563eb' }}
            >
              <PanelLeft size={18} />
            </a>
          </li>
        )}
        <li ref={viewContextRef} className="header__filter-item header__filter-item--grids">
          <a 
            className="header__filter-link active" 
            data-highlight="views"
            onClick={() => setShowViewContext(!showViewContext)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {getViewIcon(views.find(v => v.id === activeViewId)?.type || 'grid', { size: 16, color: '#64748b', className: 'header__filter-icon' })}
            <span className="header__filter-name header__filter-name--forced">
              {views.find(v => v.id === activeViewId)?.name || '未命名視圖'}
            </span>
            <ChevronDown size={14} color="#64748b" className="header__sub-icon" />
          </a>

          {/* Context Menu Dropdown */}
          {showViewContext && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: '0', minWidth: '220px', zIndex: 99999, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '0', overflow: 'hidden' }}>
              <div className="select__items" style={{ padding: '4px 0', maxHeight: '300px', overflowY: 'auto' }}>
                <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {views.map(view => (
                    <li key={view.id}>
                      <a
                        className={`select__item ${activeViewId === view.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveViewId(view.id)
                          applyViewConfig(view)
                          setShowViewContext(false)
                        }}
                        style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer', textDecoration: 'none', color: '#1e293b', fontSize: '13px', transition: 'background-color 0.15s ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {getViewIcon(view.type || 'grid', { size: 14, color: activeViewId === view.id ? '#2563eb' : '#64748b', style: { marginRight: '8px', flexShrink: 0 } })}
                        <span className="select__item-name" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: activeViewId === view.id ? '#2563eb' : 'inherit', fontWeight: activeViewId === view.id ? 600 : 400 }}>{view.name}</span>
                        {activeViewId === view.id && (
                          <Check size={16} color="#2563eb" style={{ flexShrink: 0, marginLeft: '8px' }} />
                        )}
                      </a>
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
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${filterRules.length > 0 ? 'active active--error' : activeHeaderMenu === 'filter' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'filter' ? null : 'filter') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={16} color={filterRules.length > 0 ? '#ef4444' : activeHeaderMenu === 'filter' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">{filterRules.length > 0 ? `${filterRules.length} filter${filterRules.length > 1 ? 's' : ''}` : 'Filter'}</span>
          </a>
          {activeHeaderMenu === 'filter' && (
            <div style={{ position: 'absolute', top: '100%', left: '0', minWidth: '400px', zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', padding: '12px' }} onClick={(e) => e.stopPropagation()}>
              {filterRules.length === 0 ? (
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
              )}
            </div>
          )}
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${sortField ? 'active active--error' : activeHeaderMenu === 'sort' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'sort' ? null : 'sort') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowDownAZ size={16} color={sortField ? '#ef4444' : activeHeaderMenu === 'sort' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">{sortField ? '1 sort' : 'Sort'}</span>
          </a>
          {activeHeaderMenu === 'sort' && (
            <div style={{ position: 'absolute', top: '100%', left: '0', minWidth: '320px', zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px' }} onClick={(e) => e.stopPropagation()}>
              <div className="sortings">
                <div className="sortings__empty" style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  <div style={{ marginBottom: '12px' }}>在此視圖中的記錄將不會被排序</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto' }}>
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
            </div>
          )}
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${activeHeaderMenu === 'color' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'color' ? null : 'color') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Palette size={16} color={activeHeaderMenu === 'color' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">Color</span>
          </a>
        </li>

        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${groupByField ? 'active' : activeHeaderMenu === 'group' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'group' ? null : 'group') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={16} color={groupByField || activeHeaderMenu === 'group' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">Group</span>
          </a>
          {activeHeaderMenu === 'group' && (
            <div className="groupings" style={{ position: 'absolute', top: '100%', left: '0', minWidth: '220px', zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', padding: '12px' }} onClick={(e) => e.stopPropagation()}>
              <div className="groupings__head" style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>分組欄位</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                <div
                  onClick={() => {
                    setGroupByField(null);
                    if (activeViewId) saveViewConfig(activeViewId, { groupByField: null });
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
        </li>
      </ul>
      
      <ul className="header__filter header__filter--full-width">
        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${hiddenFieldKeys.length > 0 ? 'active active--error' : activeHeaderMenu === 'hide' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'hide' ? null : 'hide') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <EyeOff size={16} color={hiddenFieldKeys.length > 0 ? '#ef4444' : activeHeaderMenu === 'hide' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">
              {hiddenFieldKeys.length > 0 ? `${hiddenFieldKeys.length} hidden` : 'Hide fields'}
            </span>
          </a>
          {activeHeaderMenu === 'hide' && (
            <div className="hidings" style={{ position: 'absolute', top: '100%', left: '0', width: '280px', zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px' }} onClick={(e) => e.stopPropagation()}>
              <div className="hidings__head" style={{ padding: '12px 12px 8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                <div className="hidings__search" style={{ position: 'relative' }}>
                  <Search size={14} className="hidings__search-icon" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Find a field"
                    className="hidings__search-input"
                    style={{ width: '100%', padding: '6px 8px 6px 32px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div className="hidings__body" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                <ul className="hidings__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {fields.map(field => {
                    const key = `field_${field.id}`
                    const isHidden = hiddenFieldKeys.includes(key)
                    return (
                      <li key={field.id} className="hidings__item" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => {
                        const newHidden = isHidden ? hiddenFieldKeys.filter(k => k !== key) : [...hiddenFieldKeys, key];
                        setHiddenFieldKeys(newHidden);
                        if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(newHidden) });
                      }}>
                        <div className={`switch ${!isHidden ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="switch__toggle" style={{ width: '28px', height: '16px', background: !isHidden ? '#2563eb' : '#cbd5e1', borderRadius: '8px', position: 'relative', transition: 'background 0.2s' }}>
                            <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: !isHidden ? '14px' : '2px', transition: 'left 0.2s' }} />
                          </div>
                          <i className={`switch__icon ${(FIELD_TYPE_ICONS as any)[field.type] ? 'has-icon' : ''}`} style={{ color: '#64748b' }}></i>
                          <span style={{ fontSize: '13px', color: '#1e293b' }}>{field.name}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div className="hidings__footer" style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                <button className="button button--secondary button--small" onClick={() => {
                  const allKeys = fields.map(f => `field_${f.id}`);
                  setHiddenFieldKeys(allKeys);
                  if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: JSON.stringify(allKeys) });
                }}>
                  Hide all
                </button>
                <button className="button button--secondary button--small" onClick={() => {
                  setHiddenFieldKeys([]);
                  if (activeViewId) saveViewConfig(activeViewId, { hiddenFields: '[]' });
                }}>
                  Show all
                </button>
              </div>
            </div>
          )}
        </li>
        
        <li className="header__filter-item" style={{ position: 'relative' }}>
          <a 
            className={`header__filter-link ${rowHeightSize !== 'small' ? 'active' : activeHeaderMenu === 'rowHeight' ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setActiveHeaderMenu(activeHeaderMenu === 'rowHeight' ? null : 'rowHeight') }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <AlignJustify size={16} color={rowHeightSize !== 'small' ? '#2563eb' : activeHeaderMenu === 'rowHeight' ? '#2563eb' : '#64748b'} className="header__filter-icon" />
            <span className="header__filter-name">Row height</span>
          </a>
          {activeHeaderMenu === 'rowHeight' && (
            <div 
              style={{ 
                position: 'absolute', 
                top: 'calc(100% + 4px)', 
                left: '0', 
                width: '200px', 
                zIndex: 99999, 
                backgroundColor: '#ffffff', 
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)', 
                borderRadius: '10px', 
                border: '1px solid #e2e8f0', 
                padding: '6px',
                animation: 'fadeIn 0.15s ease-out' 
              }} 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '4px 8px 6px 8px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                行高設定 (Row Height)
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {[
                  { id: 'small', label: '預設 (Small)', icon: <AlignJustify size={14} /> },
                  { id: 'medium', label: '中等 (Medium)', icon: <AlignJustify size={16} /> },
                  { id: 'large', label: '較大 (Large)', icon: <AlignJustify size={18} /> },
                  { id: 'extra', label: '特大 (Extra)', icon: <AlignJustify size={20} /> },
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
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                        }}
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
            </div>
          )}
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

        <li className="header__filter-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
            <button className="button button--ghost button--small" onClick={handleExportCSV}>
              <i className="iconoir-download"></i> 導出 CSV
            </button>
            <button className="button button--ghost button--small" onClick={() => csvInputRef.current?.click()}>
              <i className="iconoir-upload"></i> 匯入 CSV
            </button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVImport}
            />
          </div>
        </li>
      </ul>
    </header>
  )
}
