'use client'

import React, { useState, useRef } from 'react'
import type { User, Workspace } from '@/modules/database/types'
import { 
  ChevronsUpDown, 
  Plus, 
  ChevronRight, 
  Database as DatabaseIcon, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  PanelLeftClose,
  PanelLeft,
  Table as TableIcon,
  Users,
  UserPlus,
  Bell,
  Sun, 
  Moon, 
  LogOut, 
  Sliders,
  Search,
  Check,
  User as UserIcon,
  FileText
} from 'lucide-react'

interface SidebarProps {
  currentUser: User
  workspaces: Workspace[]
  activeWorkspaceId: number | null
  activeTableId: number | null
  collapsedWorkspaces: Record<number, boolean>
  collapsedDatabases: Record<number, boolean>
  theme: 'light' | 'dark'
  showDarkReaderPanel: boolean
  darkReaderSettings: { brightness: number; contrast: number; sepia: number; grayscale: number }
  isSidebarCollapsed?: boolean
  memberCount?: number
  notificationCount?: number
  onShowMembersModal?: () => void
  onShowNotificationsModal?: () => void
  onShowUserSettingsModal?: () => void
  onShowSubscriptionModal?: () => void
  
  // Actions
  onToggleTheme: () => void
  onLogout: () => void
  onToggleWorkspaceCollapse: (wsId: number) => void
  onToggleDatabaseCollapse: (dbId: number) => void
  onSetActiveWorkspaceId: (wsId: number) => void
  onSetActiveTableId: (tableId: number) => void
  onShowWorkspaceModal: () => void
  onShowDatabaseModal: (wsId: number) => void
  onShowCreateTableModal?: (dbId: number) => void
  onToggleSidebarCollapse?: () => void
  onSetRenameType: (type: 'workspace' | 'database' | 'table' | null) => void
  onSetRenameId: (id: number | null) => void
  onSetRenameNameValue: (name: string) => void
  onShowRenameModal: () => void
  onDeleteWorkspaceOrDb: (action: 'delete_workspace' | 'delete_database', id: number, label: string) => void
  onToggleDarkReaderPanel: () => void
  onUpdateDarkReaderSettings: (settings: Partial<{ brightness: number; contrast: number; sepia: number; grayscale: number }>) => void
  onDeleteDarkReaderSettings?: (settings: Partial<{ brightness: number; contrast: number; sepia: number; grayscale: number }>) => void
  onDeleteTable?: (tableId: number, tableName: string) => void
  userPermissions?: any
}

export default function Sidebar({
  currentUser,
  workspaces,
  activeWorkspaceId,
  activeTableId,
  collapsedDatabases,
  theme,
  isSidebarCollapsed = false,
  memberCount,
  notificationCount = 0,
  onShowMembersModal,
  onShowNotificationsModal,
  onShowUserSettingsModal,
  onShowSubscriptionModal,
  
  onToggleTheme,
  onLogout,
  onToggleDatabaseCollapse,
  onSetActiveWorkspaceId,
  onSetActiveTableId,
  onShowWorkspaceModal,
  onShowDatabaseModal,
  onShowCreateTableModal,
  onToggleSidebarCollapse,
  onSetRenameType,
  onSetRenameId,
  onSetRenameNameValue,
  onShowRenameModal,
  onDeleteWorkspaceOrDb,
  onToggleDarkReaderPanel,
  onDeleteTable,
  userPermissions
}: SidebarProps) {
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null)
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]
  const activeWorkspaceName = activeWorkspace ? activeWorkspace.name : '選擇工作區'
  const canManageStructure = userPermissions?.canManageStructure ?? true

  const toggleMenu = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMenuKey(prev => prev === key ? null : key)
  }

  const closeMenu = () => {
    setActiveMenuKey(null)
  }

  // Close menus on outside click or Escape key
  React.useEffect(() => {
    if (!activeMenuKey) return

    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveMenuKey(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuKey(null)
      }
    }

    window.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeMenuKey])

  return (
    <>
      <style>{`
        .sidebar-hover-item { transition: all 0.15s ease; }
        .sidebar-hover-item:hover { background-color: rgba(15, 23, 42, 0.05) !important; }
        .sidebar-hover-icon { transition: all 0.15s ease; }
        .sidebar-hover-icon:hover { background-color: rgba(15, 23, 42, 0.08) !important; color: #0f172a !important; }
        .sidebar-active-table {
          background-color: #eff6ff !important;
          color: #1d4ed8 !important;
          font-weight: 600 !important;
        }
        .sidebar-active-table::before {
          content: '';
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: 3px;
          background-color: #2563eb;
          border-radius: 0 4px 4px 0;
        }
      `}</style>
      <div 
        className={`layout__col-1 ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        style={{ 
          width: isSidebarCollapsed ? '0px' : '250px', 
          opacity: isSidebarCollapsed ? 0 : 1,
          visibility: isSidebarCollapsed ? 'hidden' : 'visible',
          overflow: 'hidden',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease', 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#f8fafc', 
          borderRight: isSidebarCollapsed ? 'none' : '1px solid #e2e8f0', 
          zIndex: 50,
          userSelect: 'none'
        }}
        onClick={closeMenu}
      >
        <div className="sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: '250px' }}>
          
          {/* Workspace Header Selector Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
            <div 
              className="sidebar-hover-item"
              onClick={(e) => {
                if (isSidebarCollapsed) {
                  onToggleSidebarCollapse?.()
                } else {
                  toggleMenu('workspace-selector', e)
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              title="切換工作區"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, padding: '4px 6px', borderRadius: '8px', cursor: 'pointer', overflow: 'hidden' }}
            >
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0, boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}>
                {activeWorkspaceName.charAt(0).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                  {activeWorkspaceName}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                  工作區
                </span>
              </div>
              <ChevronsUpDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
            </div>

            {onToggleSidebarCollapse && (
              <button
                onClick={onToggleSidebarCollapse}
                title="收合側邊欄"
                className="sidebar-hover-icon"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}
              >
                <PanelLeftClose size={16} />
              </button>
            )}
          </div>

          {/* Workspace Switcher Dropdown (Matching Reference SeaTable / Baserow UI) */}
          {activeMenuKey === 'workspace-selector' && (() => {
            const filteredWorkspaces = workspaces.filter(w =>
              w.name.toLowerCase().includes(workspaceSearchQuery.toLowerCase())
            )

            return (
              <div
                ref={popoverRef}
                style={{
                  position: 'absolute', top: '54px', left: '12px', right: '12px', zIndex: 100000,
                  background: '#ffffff', boxShadow: '0 15px 35px rgba(15, 23, 42, 0.18)', borderRadius: '12px',
                  border: '1px solid #cbd5e1', padding: '6px 0', animation: 'fadeIn 0.15s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Search Bar */}
                <div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                    <Search size={14} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search"
                      value={workspaceSearchQuery}
                      onChange={(e) => setWorkspaceSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#0f172a' }}
                    />
                  </div>
                </div>

                {/* Filtered Workspace List */}
                <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px 0' }}>
                  {filteredWorkspaces.map(ws => {
                    const isActive = activeWorkspaceId === ws.id
                    const initials = ws.name.slice(0, 2).toUpperCase()
                    return (
                      <div
                        key={ws.id}
                        className="sidebar-hover-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetActiveWorkspaceId(ws.id)
                          closeMenu()
                        }}
                        style={{
                          padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', fontSize: '13px', backgroundColor: isActive ? '#f8fafc' : 'transparent',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <div style={{
                            width: '26px', height: '26px', borderRadius: '6px',
                            background: isActive ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#64748b',
                            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400, color: isActive ? '#0f172a' : '#334155' }}>
                            {ws.name}
                          </span>
                        </div>
                        {isActive && <Check size={16} color="#0f172a" />}
                      </div>
                    )
                  })}
                </div>

                {/* Add New Workspace Button */}
                {canManageStructure && (
                  <div style={{ padding: '4px 10px 8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <div
                      className="sidebar-hover-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeMenu()
                        onShowWorkspaceModal()
                      }}
                      style={{
                        padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '10px',
                        cursor: 'pointer', fontSize: '13px', color: '#0f172a', fontWeight: 500,
                        border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff'
                      }}
                    >
                      <div style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={14} color="#64748b" />
                      </div>
                      <span>Add new workspace</span>
                    </div>
                  </div>
                )}

                {/* User Account Info Section */}
                <div style={{ paddingTop: '6px' }}>
                  <div style={{ padding: '4px 12px 6px 12px', fontSize: '12px', color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser?.email || 'user@example.com'}
                  </div>

                  <div
                    className="sidebar-hover-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeMenu()
                      onShowUserSettingsModal?.()
                    }}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#0f172a' }}
                  >
                    <UserIcon size={16} color="#64748b" />
                    <span>My settings</span>
                  </div>

                  <div
                    className="sidebar-hover-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeMenu()
                      onShowSubscriptionModal?.()
                    }}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#0f172a' }}
                  >
                    <FileText size={16} color="#64748b" />
                    <span>Subscriptions</span>
                  </div>

                  <div
                    className="sidebar-hover-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeMenu()
                      onLogout()
                    }}
                    style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#ef4444', fontWeight: 500 }}
                  >
                    <LogOut size={16} color="#ef4444" />
                    <span>Log out</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Navigation & Database Tree Section */}
          {activeWorkspace && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
              
              {/* Workspace Quick Actions */}
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '2px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                <div
                  onClick={() => onShowNotificationsModal?.()}
                  className="sidebar-hover-item"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bell size={16} color="#64748b" />
                    <span>站內通知</span>
                  </div>
                  {notificationCount > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', backgroundColor: '#ef4444', padding: '2px 8px', borderRadius: '10px' }}>
                      {notificationCount}
                    </span>
                  )}
                </div>

                <div
                  onClick={() => onShowMembersModal?.()}
                  className="sidebar-hover-item"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Users size={16} color="#64748b" />
                    <span>成員列表</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                    {memberCount ?? 1}
                  </span>
                </div>

                {canManageStructure && (
                  <div
                    onClick={() => onShowMembersModal?.()}
                    className="sidebar-hover-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                  >
                    <UserPlus size={16} color="#64748b" />
                    <span>邀請新成員</span>
                  </div>
                )}
              </div>

              {/* Databases Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 8px 8px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <span>資料庫 (DATABASES)</span>
                {canManageStructure && (
                  <button
                    title="建立資料庫"
                    onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                    className="sidebar-hover-icon"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>

              {/* Databases Tree */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {activeWorkspace.databases.map(db => {
                  const dbMenuKey = `db-${db.id}`
                  const isDbMenuOpen = activeMenuKey === dbMenuKey
                  const isDbCollapsed = !!collapsedDatabases[db.id]

                  return (
                    <div key={db.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Database Item Row */}
                      <div 
                        className="sidebar-hover-item"
                        style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', position: 'relative' }}
                      >
                        <div 
                          onClick={() => onToggleDatabaseCollapse(db.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}
                        >
                          <ChevronRight
                            size={14}
                            color="#64748b"
                            style={{ 
                              flexShrink: 0,
                              transition: 'transform 0.15s ease',
                              transform: !isDbCollapsed ? 'rotate(90deg)' : 'none'
                            }}
                          />
                          <DatabaseIcon size={15} color="#2563eb" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {db.name}
                          </span>
                        </div>

                        {canManageStructure && (
                          <button
                            onClick={(e) => toggleMenu(dbMenuKey, e)}
                            className="sidebar-hover-icon"
                            title="資料庫選項"
                            style={{ background: 'none', border: 'none', padding: '3px', borderRadius: '4px', color: '#64748b', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        )}

                        {/* Database Options Dropdown */}
                        {isDbMenuOpen && (
                          <div style={{ position: 'absolute', right: '0', top: '100%', zIndex: 1000, background: '#ffffff', boxShadow: '0 8px 20px rgba(15,23,42,0.15)', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '160px', padding: '4px 0' }}>
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                              <li>
                                <div
                                  className="sidebar-hover-item"
                                  onClick={() => {
                                    closeMenu()
                                    onSetRenameType('database')
                                    onSetRenameId(db.id)
                                    onSetRenameNameValue(db.name)
                                    onShowRenameModal()
                                  }}
                                  style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                >
                                  <Pencil size={14} />
                                  <span>重新命名</span>
                                </div>
                              </li>
                              <li>
                                <div
                                  className="sidebar-hover-item"
                                  onClick={() => {
                                    closeMenu()
                                    onDeleteWorkspaceOrDb('delete_database', db.id, db.name)
                                  }}
                                  style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                >
                                  <Trash2 size={14} />
                                  <span>刪除資料庫</span>
                                </div>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Tables Sub-tree */}
                      {!isDbCollapsed && (
                        <div style={{ paddingLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', marginBottom: '4px' }}>
                          {db.tables.map(table => {
                            const tblMenuKey = `tbl-${table.id}`
                            const isTblMenuOpen = activeMenuKey === tblMenuKey
                            const isActive = activeTableId === table.id

                            return (
                              <div
                                key={table.id}
                                className={`sidebar-hover-item ${isActive ? 'sidebar-active-table' : ''}`}
                                style={{ 
                                  padding: '6px 10px', 
                                  borderRadius: '6px', 
                                  position: 'relative',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer'
                                }}
                                onClick={() => onSetActiveTableId(table.id)}
                                onDoubleClick={() => {
                                  if (canManageStructure) {
                                    onSetRenameType('table')
                                    onSetRenameId(table.id)
                                    onSetRenameNameValue(table.name)
                                    onShowRenameModal()
                                  }
                                }}
                                title={`${table.name} (雙擊可重新命名)`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                  <TableIcon size={14} color={isActive ? '#2563eb' : '#64748b'} style={{ flexShrink: 0 }} />
                                  <span style={{ fontSize: '13px', color: isActive ? '#1d4ed8' : '#334155', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {table.name}
                                  </span>
                                </div>

                                {canManageStructure && (
                                  <button
                                    className="sidebar-hover-icon"
                                    title="資料表選項"
                                    onClick={(e) => toggleMenu(tblMenuKey, e)}
                                    style={{ 
                                      background: 'none',
                                      border: 'none',
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      padding: '2px 4px', 
                                      cursor: 'pointer', 
                                      color: '#64748b',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}
                                  >
                                    <MoreVertical size={13} />
                                  </button>
                                )}

                                {/* Table Options Dropdown */}
                                {isTblMenuOpen && (
                                  <div style={{ position: 'absolute', right: '0', top: '100%', zIndex: 1000, background: '#ffffff', boxShadow: '0 8px 20px rgba(15,23,42,0.15)', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '160px', padding: '4px 0' }}>
                                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                      <li>
                                        <div
                                          className="sidebar-hover-item"
                                          onClick={() => {
                                            closeMenu()
                                            onSetRenameType('table')
                                            onSetRenameId(table.id)
                                            onSetRenameNameValue(table.name)
                                            onShowRenameModal()
                                          }}
                                          style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                        >
                                          <Pencil size={14} />
                                          <span>重新命名</span>
                                        </div>
                                      </li>
                                      {onDeleteTable && (
                                        <li>
                                          <div
                                            className="sidebar-hover-item"
                                            onClick={() => {
                                              closeMenu()
                                              onDeleteTable(table.id, table.name)
                                            }}
                                            style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                          >
                                            <Trash2 size={14} />
                                            <span>刪除資料表</span>
                                          </div>
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )
                          })}

                          {canManageStructure && (
                            <div
                              className="sidebar-hover-item"
                              onClick={() => onShowCreateTableModal?.(db.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 500, borderRadius: '6px', marginTop: '2px' }}
                            >
                              <Plus size={14} />
                              <span>新增資料表</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sidebar Footer */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', padding: '10px 12px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.username || 'User'}
                </span>
                <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'capitalize' }}>
                  {currentUser?.role || 'Member'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? '切換為明亮模式' : '切換為深色模式'}
                className="sidebar-hover-icon"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                onClick={onToggleDarkReaderPanel}
                title="調整色彩與濾鏡設定"
                className="sidebar-hover-icon"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Sliders size={15} />
              </button>

              <button
                onClick={onLogout}
                title="登出系統"
                className="sidebar-hover-icon"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
