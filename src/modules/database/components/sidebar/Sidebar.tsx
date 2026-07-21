'use client'

import React, { useState } from 'react'
import { Icons } from '@/modules/database/constants'
import type { User, Workspace, Database, DynamicTable } from '@/modules/database/types'
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
  Bell
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
  collapsedWorkspaces,
  collapsedDatabases,
  theme,
  showDarkReaderPanel,
  darkReaderSettings,
  isSidebarCollapsed = false,
  memberCount,
  notificationCount = 0,
  onShowMembersModal,
  onShowNotificationsModal,
  
  onToggleTheme,
  onLogout,
  onToggleWorkspaceCollapse,
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
  onUpdateDarkReaderSettings,
  onDeleteTable,
  userPermissions
}: SidebarProps) {
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]
  const activeWorkspaceName = activeWorkspace ? activeWorkspace.name : '選擇工作區'

  const toggleMenu = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveMenuKey(prev => prev === key ? null : key)
  }

  const closeMenu = () => {
    setActiveMenuKey(null)
  }

  return (
    <>
      <style>{`
        .sidebar-hover-item { transition: background-color 0.15s ease; }
        .sidebar-hover-item:hover { background-color: rgba(0,0,0,0.04) !important; }
        .sidebar-hover-icon { transition: background-color 0.15s ease; }
        .sidebar-hover-icon:hover { background-color: rgba(0,0,0,0.08) !important; }
        .tree__sub.active { background-color: rgba(37, 99, 235, 0.08) !important; }
      `}</style>
      <div 
        className={`layout__col-1 ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        style={{ 
          width: isSidebarCollapsed ? '0px' : '240px', 
          opacity: isSidebarCollapsed ? 0 : 1,
          visibility: isSidebarCollapsed ? 'hidden' : 'visible',
          overflow: 'hidden',
          transition: 'width 0.2s ease, opacity 0.2s ease, visibility 0.2s', 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: '#f8fafc', 
          borderRight: isSidebarCollapsed ? 'none' : '1px solid #e2e8f0', 
          zIndex: 50 
        }}
        onClick={closeMenu}
      >
        <div className="sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: '240px' }}>
          {/* Workspace Selector (User Context) */}
          <a 
            className="sidebar__workspaces-selector sidebar-hover-item"
            data-highlight="workspaces"
            onClick={(e) => {
              if (isSidebarCollapsed) {
                onToggleSidebarCollapse?.()
              } else {
                toggleMenu('workspace-selector', e)
              }
            }}
            title={isSidebarCollapsed ? '點擊展開側邊欄' : '切換工作區'}
            style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', height: '52px', padding: isSidebarCollapsed ? '0' : '0 12px', cursor: 'pointer', borderBottom: '1px solid #e2e8f0' }}
          >
            <div className="sidebar__user-avatar" style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', marginRight: isSidebarCollapsed ? 0 : '10px', flexShrink: 0 }}>
              {activeWorkspaceName.charAt(0).toUpperCase()}
            </div>
            {!isSidebarCollapsed && (
              <>
                <span className="sidebar__workspaces-selector-selected-workspace" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                  {activeWorkspaceName}
                </span>
                <ChevronsUpDown className="sidebar__workspaces-selector-icon" size={14} color="#64748b" />
              </>
            )}
          </a>

          {activeMenuKey === 'workspace-selector' && (
            <div className="context select" style={{ position: 'absolute', top: '56px', left: isSidebarCollapsed ? '56px' : '12px', zIndex: 100000, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '220px' }}>
              <div className="select__items">
                <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
                  {workspaces.map(ws => (
                    <li key={ws.id}>
                      <a 
                        className={`select__item sidebar-hover-item ${activeWorkspaceId === ws.id ? 'active' : ''}`}
                        onClick={() => {
                          onSetActiveWorkspaceId(ws.id)
                          closeMenu()
                        }}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '13px', color: '#1e293b' }}
                      >
                        <span className="select__item-name">{ws.name}</span>
                      </a>
                    </li>
                  ))}
                  <li style={{ borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '4px' }}>
                    <a
                      className="select__item sidebar-hover-item"
                      onClick={() => {
                        closeMenu()
                        onShowWorkspaceModal()
                      }}
                      style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#2563eb' }}
                    >
                      <Plus className="select__item-icon" size={14} />
                      <span className="select__item-name">新增工作區</span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Sidebar With Workspace (Applications) */}
          {activeWorkspace && (
            <div className="sidebar__section sidebar__section--scrollable" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="sidebar__section-scrollable">
                <div className="sidebar__section-scrollable-inner" data-highlight="applications" style={{ padding: isSidebarCollapsed ? '8px 0' : '8px' }}>
                  {/* Top Workspace Navigation Links */}
                  {!isSidebarCollapsed && (
                    <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                      <div
                        onClick={() => onShowNotificationsModal?.()}
                        className="sidebar-hover-item"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Bell size={16} color="#64748b" />
                          <span>Notifications</span>
                        </div>
                        {notificationCount > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ffffff', backgroundColor: '#ef4444', padding: '1px 7px', borderRadius: '10px' }}>
                            {notificationCount}
                          </span>
                        )}
                      </div>

                      <div
                        onClick={() => onShowMembersModal?.()}
                        className="sidebar-hover-item"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Users size={16} color="#64748b" />
                          <span>Members</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', backgroundColor: '#e2e8f0', padding: '1px 7px', borderRadius: '10px' }}>
                          {memberCount ?? 1}
                        </span>
                      </div>

                      <div
                        onClick={() => onShowMembersModal?.()}
                        className="sidebar-hover-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500 }}
                      >
                        <UserPlus size={16} color="#64748b" />
                        <span>Invite others</span>
                      </div>
                    </div>
                  )}

                  <ul className="tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    <li>
                      <div className="tree__heading" style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', padding: isSidebarCollapsed ? '6px 0' : '6px 8px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {!isSidebarCollapsed && (
                          <div className="tree__heading-name">
                            Databases
                          </div>
                        )}
                        <a
                          className="tree__heading-add sidebar-hover-icon"
                          title="Create Database"
                          onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                          style={{ cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '4px' }}
                        >
                          <Plus size={14} />
                        </a>
                      </div>
                      
                      <ul className="tree" data-highlight="applications-database" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {activeWorkspace.databases.map(db => {
                          const dbMenuKey = `db-${db.id}`
                          const isDbMenuOpen = activeMenuKey === dbMenuKey
                          const isDbCollapsed = !!collapsedDatabases[db.id]

                          return (
                            <li key={db.id} className="tree__item" style={{ margin: '2px 0' }}>
                              <div className="tree__action tree__action--has-options sidebar-hover-item" style={{ display: 'flex', alignItems: 'center', padding: isSidebarCollapsed ? '10px 0' : '4px 8px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', borderRadius: '6px', cursor: 'pointer', position: 'relative' }}>
                                <a
                                  onClick={() => onToggleDatabaseCollapse(db.id)}
                                  className="tree__link"
                                  title={db.name}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '8px', flex: isSidebarCollapsed ? 'none' : 1, textDecoration: 'none', color: '#1e293b', fontSize: '13px', fontWeight: 500, overflow: 'hidden' }}
                                >
                                  {!isSidebarCollapsed && (
                                    <ChevronRight
                                      size={14}
                                      color="#64748b"
                                      style={{ 
                                        flexShrink: 0,
                                        transition: 'transform 0.15s ease',
                                        transform: !isDbCollapsed ? 'rotate(90deg)' : 'none'
                                      }}
                                    />
                                  )}
                                  <DatabaseIcon className="tree__icon tree__icon--type" size={isSidebarCollapsed ? 18 : 14} color="#2563eb" style={{ flexShrink: 0 }} />
                                  {!isSidebarCollapsed && <span className="tree__link-text" style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{db.name}</span>}
                                </a>

                                {!isSidebarCollapsed && (
                                  <a
                                    onClick={(e) => toggleMenu(dbMenuKey, e)}
                                    className={`tree__options sidebar-hover-icon ${isDbMenuOpen ? 'active' : ''}`}
                                    title="Database Options"
                                    style={{ padding: '4px', borderRadius: '4px', color: '#64748b', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                  >
                                    <MoreVertical size={14} />
                                  </a>
                                )}

                                {isDbMenuOpen && (
                                  <div className="context select" style={{ position: 'absolute', left: isSidebarCollapsed ? '56px' : 'auto', right: isSidebarCollapsed ? 'auto' : '0', top: isSidebarCollapsed ? '0' : '100%', zIndex: 100, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '160px' }}>
                                    <div className="select__items">
                                      <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
                                        <li>
                                          <a
                                            className="select__item sidebar-hover-item"
                                            onClick={() => {
                                              closeMenu()
                                              onSetRenameType('database')
                                              onSetRenameId(db.id)
                                              onSetRenameNameValue(db.name)
                                              onShowRenameModal()
                                            }}
                                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                          >
                                            <Pencil className="select__item-icon" size={14} />
                                            <span className="select__item-name">重新命名</span>
                                          </a>
                                        </li>
                                        <li>
                                          <a
                                            className="select__item sidebar-hover-item"
                                            onClick={() => {
                                              closeMenu()
                                              onDeleteWorkspaceOrDb('delete_database', db.id, db.name)
                                            }}
                                            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                          >
                                            <Trash2 className="select__item-icon" size={14} />
                                            <span className="select__item-name">刪除資料庫</span>
                                          </a>
                                        </li>
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {!isDbCollapsed && (
                                <div style={{ paddingLeft: isSidebarCollapsed ? '0' : '16px' }}>
                                  <ul className="tree__subs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {db.tables.map(table => {
                                      const tblMenuKey = `tbl-${table.id}`
                                      const isTblMenuOpen = activeMenuKey === tblMenuKey
                                      const isActive = activeTableId === table.id

                                      return (
                                        <li
                                          key={table.id}
                                          className={`tree__sub sidebar-hover-item ${isActive ? 'active' : ''}`}
                                          style={{ 
                                            margin: isSidebarCollapsed ? '4px 0' : '2px 0', 
                                            borderRadius: '6px', 
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start'
                                          }}
                                        >
                                          <a
                                            className="tree__sub-link"
                                            title={`${table.name} (雙擊可重新命名)`}
                                            onClick={() => onSetActiveTableId(table.id)}
                                            onDoubleClick={() => {
                                              if (!isSidebarCollapsed) {
                                                onSetRenameType('table')
                                                onSetRenameId(table.id)
                                                onSetRenameNameValue(table.name)
                                                onShowRenameModal()
                                              }
                                            }}
                                            style={{ padding: isSidebarCollapsed ? '8px 0' : '6px 8px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', flex: isSidebarCollapsed ? 'none' : 1, textDecoration: 'none', color: isActive ? '#2563eb' : '#334155', fontWeight: isActive ? 600 : 400, fontSize: '13px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          >
                                            {isSidebarCollapsed ? (
                                              <TableIcon size={16} color={isActive ? '#2563eb' : '#64748b'} />
                                            ) : (
                                              table.name
                                            )}
                                          </a>

                                          {!isSidebarCollapsed && (
                                            <a
                                              className={`tree__options sidebar-hover-icon ${isTblMenuOpen ? 'active' : ''}`}
                                              title="資料表選項"
                                              onClick={(e) => toggleMenu(tblMenuKey, e)}
                                              style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                padding: '4px 6px', 
                                                cursor: 'pointer', 
                                                color: '#64748b',
                                                borderRadius: '4px',
                                                marginRight: '2px',
                                                flexShrink: 0
                                              }}
                                            >
                                              <MoreVertical size={14} />
                                            </a>
                                          )}

                                          {isTblMenuOpen && (
                                            <div className="context select" style={{ position: 'absolute', left: isSidebarCollapsed ? '56px' : 'auto', right: isSidebarCollapsed ? 'auto' : '0', top: isSidebarCollapsed ? '0' : '100%', zIndex: 1000, background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', borderRadius: '6px', border: '1px solid #e2e8f0', minWidth: '160px' }}>
                                              <div className="select__items">
                                                <ul className="select__items-list" style={{ listStyle: 'none', margin: 0, padding: '4px 0' }}>
                                                  <li>
                                                    <a
                                                      className="select__item sidebar-hover-item"
                                                      onClick={() => {
                                                        closeMenu()
                                                        onSetRenameType('table')
                                                        onSetRenameId(table.id)
                                                        onSetRenameNameValue(table.name)
                                                        onShowRenameModal()
                                                      }}
                                                      style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                                    >
                                                      <Pencil className="select__item-icon" size={14} />
                                                      <span className="select__item-name">重新命名</span>
                                                    </a>
                                                  </li>
                                                  {onDeleteTable && (
                                                    <li>
                                                      <a
                                                        className="select__item sidebar-hover-item"
                                                        onClick={() => {
                                                          closeMenu()
                                                          onDeleteTable(table.id, table.name)
                                                        }}
                                                        style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                                      >
                                                        <Trash2 className="select__item-icon" size={14} />
                                                        <span className="select__item-name">刪除資料表</span>
                                                      </a>
                                                    </li>
                                                  )}
                                                </ul>
                                              </div>
                                            </div>
                                          )}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                  {!isSidebarCollapsed && (
                                    <a
                                      className="tree__sub-add sidebar-hover-item"
                                      onClick={() => onShowCreateTableModal?.(db.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', color: '#64748b', fontSize: '12px', cursor: 'pointer', fontWeight: 500, borderRadius: '6px', margin: '2px 0' }}
                                    >
                                      <Plus className="tree__sub-add-icon" size={14} />
                                      新增資料表
                                    </a>
                                  )}
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Sidebar Foot */}
          <div className="sidebar__section sidebar__section--bottom" style={{ marginTop: 'auto', borderTop: '1px solid #e2e8f0', padding: isSidebarCollapsed ? '8px 0' : '8px 12px' }}>
            <div className="sidebar__foot" style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between' }}>
              {!isSidebarCollapsed && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>FYCD Manager</span>
              )}
              {onToggleSidebarCollapse && (
                <a
                  className="sidebar__foot-link sidebar-hover-icon"
                  onClick={onToggleSidebarCollapse}
                  title={isSidebarCollapsed ? '展開側邊欄' : '收闔側邊欄'}
                  style={{ cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isSidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
