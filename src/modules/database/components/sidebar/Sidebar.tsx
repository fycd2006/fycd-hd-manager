'use client'

import React, { useState, useRef } from 'react'
import type { User, Workspace } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'
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
  PanelLeftOpen,
  Home,
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
  FileText,
  GripVertical
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
  onSelectDashboard?: () => void
  onMoveTableToDatabase?: (tableId: number, targetDbId: number, targetOrder?: number) => void
  onReorderDatabases?: (wsId: number, orderedDbIds: number[]) => void
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
  userPermissions,
  onSelectDashboard,
  onMoveTableToDatabase,
  onReorderDatabases
}: SidebarProps) {
  const { t } = useI18n()
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null)
  
  // Drag and Drop State
  const [draggedItem, setDraggedItem] = useState<{ type: 'database' | 'table'; id: number; sourceDbId?: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: 'database' | 'table'; id: number; position?: 'before' | 'after' | 'inside' } | null>(null)
  
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
          background-color: #F4F4F5 !important;
          color: #2d470d !important;
          font-weight: 600 !important;
        }
        .sidebar-active-table::before {
          content: '';
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: 3px;
          background-color: #3F6212;
          border-radius: 0 4px 4px 0;
        }
      `}</style>

      <div
        className={`layout__col-1 ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        style={{
          width: isSidebarCollapsed ? '56px' : '250px',
          minWidth: isSidebarCollapsed ? '56px' : '250px',
          maxWidth: isSidebarCollapsed ? '56px' : '250px',
          opacity: 1,
          visibility: 'visible',
          overflow: 'hidden',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
          zIndex: 50,
          userSelect: 'none'
        }}
        onClick={closeMenu}
      >
        {isSidebarCollapsed ? (
          /* Mini Collapsed Sidebar Strip (width: 56px) */
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', boxSizing: 'border-box' }}>
            {/* Top Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
              {/* Top Expand Button & Logo */}
              <button
                onClick={onToggleSidebarCollapse}
                title="展開側邊欄"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <img
                  src="/logo.jpg"
                  alt="FYCD HD Manager Logo"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #EA580C', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)' }}
                />
              </button>

              <button
                onClick={onToggleSidebarCollapse}
                title="展開側邊欄"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#F4F4F5',
                  border: '1px solid #E4E4E7',
                  color: '#18181B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F4F4F5'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#F4F4F5'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <PanelLeftOpen size={18} />
              </button>

              <div style={{ width: '28px', height: '1px', backgroundColor: '#e2e8f0' }} />

              {/* Home Dashboard Shortcut */}
              {onSelectDashboard && (
                <button
                  onClick={onSelectDashboard}
                  title={t('nav.home')}

                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: activeTableId === 0 ? '#F4F4F5' : 'transparent',
                    border: activeTableId === 0 ? '1px solid #E4E4E7' : '1px solid transparent',
                    color: activeTableId === 0 ? '#3F6212' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTableId !== 0) e.currentTarget.style.backgroundColor = '#f1f5f9'
                  }}
                  onMouseLeave={(e) => {
                    if (activeTableId !== 0) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Home size={18} />
                </button>
              )}

              {/* Workspace Badge Icon */}
              <div
                title={`${t('nav.workspaces')}: ${activeWorkspaceName}`}
                onClick={onToggleSidebarCollapse}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: '#18181B',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(63, 98, 18, 0.35)',
                  transition: 'transform 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {activeWorkspaceName.charAt(0).toUpperCase()}
              </div>

            </div>

            {/* Bottom Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' }}>
              <button
                onClick={onToggleTheme}
                title={theme === 'dark' ? t('nav.toggleLightMode') : t('nav.toggleDarkMode')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={onLogout}
                title={t('nav.logout')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: '250px' }}>
            {/* Global Backdrop Dismiss for Active Sidebar Dropdown Menus */}
            {activeMenuKey && (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'transparent', pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMenuKey(null)
                }}
              />
            )}

            {/* Layer 1: Topmost Workspace Header Selector Bar (Image 3 Content - 52px height aligned with toolbar) */}
            <div style={{ height: '52px', minHeight: '52px', maxHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', borderBottom: '1px solid #e2e8f0', backgroundColor: 'var(--bg-secondary)', boxSizing: 'border-box', overflow: 'hidden' }}>

              <div
                className="sidebar-hover-item"
                onClick={(e) => {
                  if (isSidebarCollapsed) {
                    onToggleSidebarCollapse?.()
                  } else {
                    toggleMenu('workspace-selector', e)
                  }
                }}
                title={t('nav.switchWorkspace')}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, height: '38px', padding: '0 8px', borderRadius: '8px', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#18181B', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0, boxShadow: '0 1px 4px rgba(24, 24, 27, 0.2)' }}>
                  {activeWorkspaceName.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', justifyContent: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                    {activeWorkspaceName}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, lineHeight: '1' }}>
                    工作區
                  </span>
                </div>
                <ChevronsUpDown size={14} color="#64748b" style={{ flexShrink: 0 }} />
              </div>

              {onToggleSidebarCollapse && (
                <button
                  onClick={onToggleSidebarCollapse}
                  title={t('nav.collapseSidebar')}
                  className="sidebar-hover-icon"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px', flexShrink: 0 }}
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
            </div>


            {/* Workspace Switcher Dropdown (Positioned cleanly below top 52px bar at top: 56px) */}
            {activeMenuKey === 'workspace-selector' && (() => {
              const filteredWorkspaces = workspaces.filter(w =>
                w.name.toLowerCase().includes(workspaceSearchQuery.toLowerCase())
              )

              return (
                <div
                  ref={popoverRef}
                  style={{
                    position: 'absolute', top: '56px', left: '6px', right: '6px', zIndex: 100000,
                    background: '#ffffff', boxShadow: '0 20px 45px -8px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(0,0,0,0.04)', borderRadius: '14px',
                    border: '1px solid #e2e8f0', padding: '6px', animation: 'fadeIn 0.15s ease-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
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
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (canManageStructure) {
                              closeMenu()
                              onSetRenameType('workspace')
                              onSetRenameId(ws.id)
                              onSetRenameNameValue(ws.name)
                              onShowRenameModal()
                            }
                          }}
                          style={{
                            padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            cursor: 'pointer', fontSize: '13px', backgroundColor: isActive ? '#F4F4F5' : 'transparent',
                            borderRadius: '8px', marginBottom: '2px', transition: 'background-color 0.12s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <div style={{
                              width: '26px', height: '26px', borderRadius: '7px',
                              background: isActive ? '#3F6212' : '#F4F4F5',
                              color: isActive ? '#ffffff' : '#3F6212',
                              border: isActive ? 'none' : '1px solid #E4E4E7',
                              boxShadow: isActive ? '0 2px 6px rgba(63, 98, 18, 0.25)' : 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: 700, flexShrink: 0
                            }}>
                              {initials}
                            </div>

                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 400, color: isActive ? '#0f172a' : '#334155' }}>
                              {ws.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {canManageStructure && (
                              <button
                                title={t('nav.renameWorkspace')}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  closeMenu()
                                  onSetRenameType('workspace')
                                  onSetRenameId(ws.id)
                                  onSetRenameNameValue(ws.name)
                                  onShowRenameModal()
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  color: '#94a3b8',
                                  padding: '3px 6px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {isActive && <Check size={16} color="#3F6212" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>


                  {/* Add New Workspace Button */}
                  {canManageStructure && (
                    <div style={{ padding: '6px 4px 6px 4px', borderBottom: '1px solid #f1f5f9' }}>
                      <div
                        className="sidebar-hover-item"
                        onClick={(e) => {
                          e.stopPropagation()
                          closeMenu()
                          onShowWorkspaceModal()
                        }}
                        style={{
                          padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '10px',
                          cursor: 'pointer', fontSize: '13px', color: '#18181B', fontWeight: 600,
                          border: '1.5px dashed #E4E4E7', borderRadius: '10px', backgroundColor: '#F4F4F5',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F4F4F5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F4F4F5'}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                          <Plus size={14} color="#3F6212" />
                        </div>
                        <span>{t('nav.createWorkspace')}</span>
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
                      <span>{t('nav.accountSettings')}</span>
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
                      <span>{t('common.settings')}</span>
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
                      <span>{t('nav.logout')}</span>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Navigation & Database Tree Section */}
            {activeWorkspace && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>

                {/* Workspace Quick Actions */}
                <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                  <div
                    onClick={() => onSelectDashboard ? onSelectDashboard() : onSetActiveTableId(0)}
                    className="sidebar-hover-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: activeTableId === null || activeTableId === 0 ? 600 : 500,
                      backgroundColor: activeTableId === null || activeTableId === 0 ? '#F4F4F5' : 'transparent',
                      color: activeTableId === null || activeTableId === 0 ? '#3F6212' : '#334155',
                      boxShadow: activeTableId === null || activeTableId === 0 ? 'inset 0 0 0 1px rgba(63, 98, 18, 0.18)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Home size={16} color={activeTableId === null || activeTableId === 0 ? '#3F6212' : '#64748b'} />
                    <span>{t('nav.home')}</span>
                  </div>
                  <div
                    onClick={() => onShowNotificationsModal?.()}
                    className="sidebar-hover-item"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s ease' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Bell size={16} color="#64748b" />
                      <span>{t('nav.notifications')}</span>
                    </div>
                    {notificationCount > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '1px 7px', borderRadius: '10px' }}>
                        {notificationCount}
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => onShowMembersModal?.()}
                    className="sidebar-hover-item"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s ease' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Users size={16} color="#64748b" />
                      <span>{t('nav.members')}</span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#18181B', backgroundColor: '#F4F4F5', border: '1px solid #F4F4F5', padding: '1px 7px', borderRadius: '10px' }}>
                      {memberCount ?? 1}
                    </span>
                  </div>

                  {canManageStructure && (
                    <div
                      onClick={() => onShowMembersModal?.()}
                      className="sidebar-hover-item"
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', color: '#334155', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s ease' }}
                    >
                      <UserPlus size={16} color="#64748b" />
                      <span>{t('members.inviteMember')}</span>
                    </div>
                  )}
                </div>


                {/* Databases Header */}
                <div 
                  onClick={() => {
                    const wsId = activeWorkspace?.id || activeWorkspaceId
                    if (wsId) onShowDatabaseModal(wsId)
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', borderRadius: '6px', userSelect: 'none' }}
                  className="sidebar-hover-item"
                  title={t('nav.createDatabase')}
                >
                  <span>{t('nav.createDatabase')}</span>
                  <button
                    title={t('nav.createDatabase')}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const wsId = activeWorkspace?.id || activeWorkspaceId
                      if (wsId) onShowDatabaseModal(wsId)
                    }}
                    style={{
                      background: '#18181B',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#ffffff',
                      padding: '4px',
                      borderRadius: '5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      transition: 'transform 0.1s ease'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.92)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <Plus size={14} color="#ffffff" />
                  </button>
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
                          draggable={canManageStructure}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'database', id: db.id }))
                            setDraggedItem({ type: 'database', id: db.id })
                          }}
                          onDragOver={(e) => {
                            if (!draggedItem) return
                            e.preventDefault()
                            e.stopPropagation()
                            if (draggedItem.type === 'database' && draggedItem.id !== db.id) {
                              setDropTarget({ type: 'database', id: db.id })
                            } else if (draggedItem.type === 'table') {
                              setDropTarget({ type: 'database', id: db.id, position: 'inside' })
                            }
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault()
                            setDropTarget(prev => prev?.id === db.id ? null : prev)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!draggedItem) return
                            if (draggedItem.type === 'database' && draggedItem.id !== db.id && activeWorkspace) {
                              const currentDbs = activeWorkspace.databases.map(d => d.id)
                              const fromIdx = currentDbs.indexOf(draggedItem.id)
                              const toIdx = currentDbs.indexOf(db.id)
                              if (fromIdx !== -1 && toIdx !== -1) {
                                currentDbs.splice(fromIdx, 1)
                                currentDbs.splice(toIdx, 0, draggedItem.id)
                                if (onReorderDatabases) onReorderDatabases(activeWorkspace.id, currentDbs)
                              }
                            } else if (draggedItem.type === 'table') {
                              if (onMoveTableToDatabase) onMoveTableToDatabase(draggedItem.id, db.id)
                            }
                            setDraggedItem(null)
                            setDropTarget(null)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                            backgroundColor: dropTarget?.type === 'database' && dropTarget.id === db.id && dropTarget.position === 'inside' ? '#FFF7ED' : undefined,
                            border: dropTarget?.type === 'database' && dropTarget.id === db.id && dropTarget.position === 'inside' ? '2px dashed #EA580C' : dropTarget?.type === 'database' && dropTarget.id === db.id ? '2px solid #EA580C' : undefined,
                          }}
                        >
                          <div
                            onClick={() => onToggleDatabaseCollapse(db.id)}
                            onDoubleClick={() => {
                              if (canManageStructure) {
                                onSetRenameType('database')
                                onSetRenameId(db.id)
                                onSetRenameNameValue(db.name)
                                onShowRenameModal()
                              }
                            }}
                            title={`${db.name} (${t('nav.doubleClickRename')})`}
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
                            <DatabaseIcon size={15} color="#3F6212" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {db.name}
                            </span>
                          </div>

                          {canManageStructure && (
                            <button
                              onClick={(e) => toggleMenu(dbMenuKey, e)}
                              className="sidebar-hover-icon"
                              title={t('nav.databaseOptions')}
                              style={{ background: 'none', border: 'none', padding: '3px', borderRadius: '4px', color: '#64748b', display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <MoreVertical size={14} />
                            </button>
                          )}

                          {/* Database Options Dropdown */}
                          {isDbMenuOpen && (
                            <div style={{ position: 'absolute', right: '0', top: '100%', zIndex: 100000, background: '#ffffff', boxShadow: '0 8px 20px rgba(15,23,42,0.15)', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '160px', padding: '4px 0' }}>
                              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                <li>
                                  <div
                                    className="sidebar-hover-item"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      closeMenu()
                                      onSetRenameType('database')
                                      onSetRenameId(db.id)
                                      onSetRenameNameValue(db.name)
                                      onShowRenameModal()
                                    }}
                                    style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                  >
                                    <Pencil size={14} />
                                    <span>{t('common.rename')}</span>
                                  </div>
                                </li>
                                <li>
                                  <div
                                    className="sidebar-hover-item"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      closeMenu()
                                      onDeleteWorkspaceOrDb('delete_database', db.id, db.name)
                                    }}
                                    style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                    <span>{t('nav.deleteDatabase')}</span>
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
                                  draggable={canManageStructure}
                                  onDragStart={(e) => {
                                    e.stopPropagation()
                                    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'table', id: table.id, sourceDbId: db.id }))
                                    setDraggedItem({ type: 'table', id: table.id, sourceDbId: db.id })
                                  }}
                                  onDragOver={(e) => {
                                    if (draggedItem?.type === 'table' && draggedItem.id !== table.id) {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setDropTarget({ type: 'table', id: table.id })
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    e.preventDefault()
                                    setDropTarget(prev => prev?.id === table.id ? null : prev)
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (draggedItem?.type === 'table' && draggedItem.id !== table.id) {
                                      const targetDbId = db.id
                                      const targetTableIndex = db.tables.findIndex(t => t.id === table.id)
                                      if (onMoveTableToDatabase) onMoveTableToDatabase(draggedItem.id, targetDbId, targetTableIndex >= 0 ? targetTableIndex : undefined)
                                    }
                                    setDraggedItem(null)
                                    setDropTarget(null)
                                  }}
                                  className={`sidebar-hover-item ${isActive ? 'sidebar-active-table' : ''}`}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    backgroundColor: dropTarget?.type === 'table' && dropTarget.id === table.id ? '#FFF7ED' : undefined,
                                    borderTop: dropTarget?.type === 'table' && dropTarget.id === table.id ? '2px solid #EA580C' : undefined,
                                  }}
                                  onClick={() => onSetActiveTableId(table.id)}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation()
                                    if (canManageStructure) {
                                      onSetRenameType('table')
                                      onSetRenameId(table.id)
                                      onSetRenameNameValue(table.name)
                                      onShowRenameModal()
                                    }
                                  }}
                                  title={`${table.name} (${t('nav.doubleClickRename')})`}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                                    <TableIcon size={14} color={isActive ? '#3F6212' : '#64748b'} style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: '13px', color: isActive ? '#3F6212' : '#334155', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {table.name}
                                    </span>
                                  </div>


                                  {canManageStructure && (
                                    <button
                                      className="sidebar-hover-icon"
                                      title={t('nav.tableOptions')}
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
                                    <div style={{ position: 'absolute', right: '0', top: '100%', zIndex: 100000, background: '#ffffff', boxShadow: '0 8px 20px rgba(15,23,42,0.15)', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '160px', padding: '4px 0' }}>
                                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                        <li>
                                          <div
                                            className="sidebar-hover-item"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              closeMenu()
                                              onSetRenameType('table')
                                              onSetRenameId(table.id)
                                              onSetRenameNameValue(table.name)
                                              onShowRenameModal()
                                            }}
                                            style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#1e293b' }}
                                          >
                                            <Pencil size={14} />
                                            <span>{t('common.rename')}</span>
                                          </div>
                                        </li>
                                        {onDeleteTable && (
                                          <li>
                                            <div
                                              className="sidebar-hover-item"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                closeMenu()
                                                onDeleteTable(table.id, table.name)
                                              }}
                                              style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#ef4444', cursor: 'pointer' }}
                                            >
                                              <Trash2 size={14} />
                                              <span>{t('nav.deleteTable')}</span>
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
                                <span>{t('nav.createTable')}</span>
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
            <div style={{ marginTop: 'auto', height: '44px', minHeight: '44px', maxHeight: '44px', borderTop: '1px solid #e2e8f0', padding: '0 12px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <img
                  src="/logo.jpg"
                  alt="FYCD HD Manager Logo"
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--brand-orange-main, #EA580C)', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  FYCD HD Manager
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button
                  onClick={onToggleTheme}
                  title={theme === 'dark' ? t('nav.toggleLightMode') : t('nav.toggleDarkMode')}
                  className="sidebar-hover-icon"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>

                <button
                  onClick={onToggleDarkReaderPanel}
                  title={t('nav.filterSettings')}
                  className="sidebar-hover-icon"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Sliders size={15} />
                </button>

                <button
                  onClick={onLogout}
                  title={t('nav.logout')}
                  className="sidebar-hover-icon"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '5px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
