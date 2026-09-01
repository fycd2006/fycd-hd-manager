'use client'

import React, { useState } from 'react'
import { motion } from 'motion/react'
import type { Workspace, User } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarMenuAction,
} from '@/components/animate-ui/components/radix/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/animate-ui/components/radix/dropdown-menu'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Home,
  Bell,
  Users,
  Database as DatabaseIcon,
  Table as TableIcon,
  Plus,
  ChevronRight,
  ChevronsUpDown,
  MoreHorizontal,
  Trash2,
  Pencil,
  Settings,
  LogOut,
  Moon,
  Sun,
  Sliders,
  Sparkles,
  CreditCard,
  FolderPlus,
  Check,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import {
  AnimatedHome,
  AnimatedBell,
  AnimatedUsers,
  AnimatedDatabase,
  AnimatedTable,
  AnimatedFolderPlus,
  AnimatedPlus,
} from '@/components/animate-ui/icons'

interface SidebarProps {
  currentUser: User
  workspaces: Workspace[]
  activeWorkspaceId: number | null
  activeTableId: number | null
  collapsedWorkspaces?: Record<number, boolean>
  collapsedDatabases: Record<number, boolean>
  theme: 'light' | 'dark'
  showDarkReaderPanel?: boolean
  darkReaderSettings?: { brightness: number; contrast: number; sepia: number; grayscale: number }
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
  onToggleWorkspaceCollapse?: (wsId: number) => void
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
  onUpdateDarkReaderSettings?: (settings: Partial<{ brightness: number; contrast: number; sepia: number; grayscale: number }>) => void
  onDeleteDarkReaderSettings?: (settings: Partial<{ brightness: number; contrast: number; sepia: number; grayscale: number }>) => void
  onDeleteTable?: (tableId: number, tableName: string) => void
  userPermissions?: any
  onSelectDashboard?: () => void
  onMoveTableToDatabase?: (tableId: number, targetDbId: number, targetOrder?: number) => void
  onReorderDatabases?: (wsId: number, orderedDbIds: number[]) => void
}

export default function AppSidebar({
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
}: SidebarProps) {
  const { t } = useI18n()

  // Drag and drop state for tables
  const [draggedItem, setDraggedItem] = useState<{ type: 'database' | 'table'; id: number; sourceDbId?: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: 'database' | 'table'; id: number } | null>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]
  const canManageStructure = userPermissions?.canManageStructure ?? true

  const userInitials = (currentUser?.username || currentUser?.email || 'U').slice(0, 2).toUpperCase()

  return (
    <SidebarProvider open={!isSidebarCollapsed} onOpenChange={() => onToggleSidebarCollapse?.()}>
      <div
        className={`layout__col-1 ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}
        style={{
          width: isSidebarCollapsed ? '56px' : '250px',
          minWidth: isSidebarCollapsed ? '56px' : '250px',
          maxWidth: isSidebarCollapsed ? '56px' : '250px',
          transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 10,
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Sidebar collapsible="none" className="w-full h-full bg-slate-50/50 dark:bg-slate-900/50 border-none">
          {/* 1. Header: Workspace Switcher & Collapse Toggle */}
          <SidebarHeader style={{ height: '52px', minHeight: '52px', maxHeight: '52px', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }} className="border-b border-slate-200/60 dark:border-slate-800/60">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
              <SidebarMenu style={{ flex: 1, minWidth: 0 }}>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        style={{ display: 'flex', alignItems: 'center', width: '100%', gap: isSidebarCollapsed ? 0 : '8px', padding: isSidebarCollapsed ? '0 4px' : '0 8px', borderRadius: '8px', height: '42px', minHeight: '42px', maxHeight: '42px', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}
                        className="hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800 transition-colors"
                      >
                        <div
                          style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: '#059669', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}
                          className="shadow-sm"
                        >
                          {activeWorkspace?.name?.[0]?.toUpperCase() || 'F'}
                        </div>
                        {!isSidebarCollapsed && (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {activeWorkspace?.name || 'FYCD 工作區'}
                              </span>
                              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {activeWorkspace?.databases?.length || 0} 個資料庫
                              </span>
                            </div>
                            <ChevronsUpDown style={{ width: '14px', height: '14px', marginLeft: 'auto', flexShrink: 0, color: '#94a3b8' }} />
                          </>
                        )}
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-64 rounded-xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuLabel style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', padding: '4px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    工作區列表
                  </DropdownMenuLabel>
                  {workspaces.map((ws, index) => {
                    const isSelected = ws.id === activeWorkspaceId
                    return (
                      <DropdownMenuItem
                        key={ws.id}
                        onClick={() => onSetActiveWorkspaceId(ws.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#f0fdf4' : undefined,
                        }}
                        className="hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-slate-100 dark:focus:bg-slate-800 data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-800 transition-colors"
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          minWidth: '24px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                          background: isSelected ? '#ecfdf5' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          flexShrink: 0,
                          color: isSelected ? '#059669' : '#334155'
                        }}>
                          {ws.name[0]?.toUpperCase() || 'W'}
                        </div>
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '13px',
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? '#059669' : '#0f172a'
                        }}>
                          {ws.name}
                        </div>
                        {isSelected && <Check style={{ width: '14px', height: '14px', color: '#059669', marginLeft: 'auto', flexShrink: 0 }} />}
                        <DropdownMenuShortcut style={{ marginLeft: isSelected ? '4px' : 'auto' }}>⌘{index + 1}</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  
                  {canManageStructure && (
                    <DropdownMenuItem
                      onClick={onShowWorkspaceModal}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: '#059669', fontWeight: 600, fontSize: '13px' }}
                      className="hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <div style={{ width: '24px', height: '24px', minWidth: '24px', borderRadius: '6px', border: '1px dashed #6ee7b7', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#059669' }}>
                        <Plus style={{ width: '14px', height: '14px' }} />
                      </div>
                      <span>建立新工作區</span>
                    </DropdownMenuItem>
                  )}

                  {activeWorkspace && canManageStructure && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          onSetRenameType('workspace')
                          onSetRenameId(activeWorkspace.id)
                          onSetRenameNameValue(activeWorkspace.name)
                          onShowRenameModal()
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#475569' }}
                        className="hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil style={{ width: '13px', height: '13px' }} />
                        <span>重新命名當前工作區</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteWorkspaceOrDb('delete_workspace', activeWorkspace.id, activeWorkspace.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}
                        className="hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 style={{ width: '13px', height: '13px' }} />
                        <span>刪除當前工作區</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Sidebar Collapse Toggle Button */}
          {!isSidebarCollapsed && (
            <button
              type="button"
              title={t('nav.collapseSidebar') || '收合側邊欄'}
              onClick={(e) => {
                e.stopPropagation()
                onToggleSidebarCollapse?.()
              }}
              style={{
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              className="hover:bg-slate-200/70 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <PanelLeftClose style={{ width: '16px', height: '16px' }} />
            </button>
          )}
        </div>
      </SidebarHeader>

        {/* 2. Content: Navigation & Databases/Tables Tree */}
        <SidebarContent className="p-2 gap-3">
          {/* Quick Platform Navigation Group */}
          <SidebarGroup className="p-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={!activeTableId || activeTableId === 0}
                  onClick={onSelectDashboard}
                  tooltip={isSidebarCollapsed ? (t('nav.home') || '首頁') : undefined}
                  className="data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-700 dark:data-[active=true]:bg-emerald-950/40 dark:data-[active=true]:text-emerald-400 font-medium"
                >
                  <AnimatedHome style={{ width: '16px', height: '16px', minWidth: '16px', color: '#059669', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.home') || '首頁'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowNotificationsModal}
                  tooltip={isSidebarCollapsed ? (t('nav.notifications') || '通知中心') : undefined}
                >
                  <AnimatedBell style={{ width: '16px', height: '16px', minWidth: '16px', color: '#64748b', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.notifications') || '通知中心'}</span>
                  {notificationCount > 0 && (
                    <SidebarMenuBadge style={{ background: '#f97316', color: '#ffffff' }}>
                      {notificationCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowMembersModal}
                  tooltip={isSidebarCollapsed ? (t('nav.members') || '成員管理') : undefined}
                >
                  <AnimatedUsers style={{ width: '16px', height: '16px', minWidth: '16px', color: '#64748b', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.members') || '成員管理'}</span>
                  {memberCount !== undefined && (
                    <SidebarMenuBadge style={{ color: '#94a3b8' }}>
                      {memberCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          {/* Databases & Tables Group */}
          <SidebarGroup className="p-0 mt-1">
            <SidebarGroupLabel
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#64748b',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
              className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              <span style={{ whiteSpace: 'nowrap' }}>資料庫清單</span>
              {canManageStructure && activeWorkspaceId && !isSidebarCollapsed && (
                <button
                  type="button"
                  onClick={() => onShowDatabaseModal(activeWorkspaceId)}
                  title={t('nav.createDatabase') || '新增資料庫'}
                  aria-label={t('nav.createDatabase') || '新增資料庫'}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    borderRadius: '5px',
                    color: '#64748b',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 active:scale-95"
                >
                  <FolderPlus style={{ width: '14px', height: '14px' }} />
                  <span className="sr-only">{t('nav.createDatabase') || '新增資料庫'}</span>
                </button>
              )}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu>
                {activeWorkspace?.databases?.map((db) => {
                  const isDbCollapsed = collapsedDatabases[db.id] ?? false
                  const hasTables = db.tables && db.tables.length > 0

                  return (
                    <Collapsible
                      key={db.id}
                      open={!isDbCollapsed}
                      onOpenChange={() => onToggleDatabaseCollapse(db.id)}
                      className="group/collapsible w-full"
                    >
                      <SidebarMenuItem style={{ position: 'relative', width: '100%' }} className="group/menu-item">
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }} className="group/db-row">
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                              tooltip={isSidebarCollapsed ? db.name : undefined}
                              style={{ display: 'flex', alignItems: 'center', width: '100%', height: '32px', paddingLeft: '6px', paddingRight: canManageStructure && !isSidebarCollapsed ? '32px' : '8px' }}
                              className="font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              {!isSidebarCollapsed && (
                                <ChevronRight
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    minWidth: '14px',
                                    color: '#94a3b8',
                                    transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    transform: !isDbCollapsed ? 'rotate(90deg)' : 'none',
                                    marginRight: '4px',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <AnimatedDatabase style={{ width: '16px', height: '16px', minWidth: '16px', color: '#059669', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '13px', marginLeft: '6px' }}>{db.name}</span>
                            </SidebarMenuButton>
                          </CollapsibleTrigger>

                          {/* Database Options Menu */}
                          {!isSidebarCollapsed && canManageStructure && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction showOnHover style={{ top: '6px' }}>
                                  <MoreHorizontal style={{ width: '13px', height: '13px', minWidth: '13px' }} />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-44 rounded-xl">
                                <DropdownMenuItem
                                  onClick={() => {
                                    onSetRenameType('database')
                                    onSetRenameId(db.id)
                                    onSetRenameNameValue(db.name)
                                    onShowRenameModal()
                                  }}
                                  className="cursor-pointer gap-2"
                                >
                                  <Pencil style={{ width: '14px', height: '14px' }} />
                                  <span>{t('common.rename')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onShowCreateTableModal?.(db.id)}
                                  className="cursor-pointer gap-2"
                                >
                                  <Plus style={{ width: '14px', height: '14px', color: '#059669' }} />
                                  <span>{t('nav.createTable')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDeleteWorkspaceOrDb('delete_database', db.id, db.name)}
                                  className="cursor-pointer gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                  <span>{t('nav.deleteDatabase')}</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {/* Tables Submenu List */}
                        {!isSidebarCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub className="my-0.5">
                              {hasTables ? (
                                db.tables.map((table) => {
                                  const isActive = activeTableId === table.id

                                  return (
                                    <SidebarMenuSubItem
                                      key={table.id}
                                      style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}
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
                                      className={`group/table-row group/sub-item ${dropTarget?.id === table.id ? 'border-t-2 border-orange-500 bg-orange-50/50' : ''}`}
                                    >
                                      <SidebarMenuSubButton
                                        isActive={isActive}
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
                                        style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', height: '28px', paddingRight: canManageStructure ? '30px' : '6px' }}
                                        className={`group/btn ${isActive ? 'text-emerald-800 dark:text-emerald-300 font-semibold' : ''}`}
                                      >
                                        {isActive && (
                                          <motion.div
                                            layoutId="active-sidebar-table-indicator"
                                            className="absolute inset-0 rounded-md bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-500/15 dark:border-emerald-500/30 pointer-events-none"
                                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                          />
                                        )}
                                        <AnimatedTable style={{ position: 'relative', zIndex: 1, width: '14px', height: '14px', minWidth: '14px', color: isActive ? '#059669' : '#64748b', flexShrink: 0 }} />
                                        <span style={{ position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', marginLeft: '6px' }}>{table.name}</span>
                                      </SidebarMenuSubButton>

                                      {/* Table Options Dropdown Action */}
                                      {canManageStructure && (
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <SidebarMenuAction showOnHover>
                                              <MoreHorizontal style={{ width: '13px', height: '13px', minWidth: '13px' }} />
                                            </SidebarMenuAction>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent side="right" align="start" className="w-40 rounded-xl">
                                            <DropdownMenuItem
                                              onClick={() => {
                                                onSetRenameType('table')
                                                onSetRenameId(table.id)
                                                onSetRenameNameValue(table.name)
                                                onShowRenameModal()
                                              }}
                                              className="cursor-pointer gap-2"
                                            >
                                              <Pencil style={{ width: '14px', height: '14px' }} />
                                              <span>{t('common.rename')}</span>
                                            </DropdownMenuItem>
                                            {onDeleteTable && (
                                              <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                  onClick={() => onDeleteTable(table.id, table.name)}
                                                  className="cursor-pointer gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                >
                                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                                  <span>{t('nav.deleteTable')}</span>
                                                </DropdownMenuItem>
                                              </>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      )}
                                    </SidebarMenuSubItem>
                                  )
                                })
                              ) : (
                                <div className="px-2 py-1 text-xs text-slate-400 italic">
                                  無資料表
                                </div>
                              )}

                              {/* Create Table Quick Button */}
                              {canManageStructure && (
                                <SidebarMenuSubItem style={{ width: '100%' }}>
                                  <button
                                    onClick={() => onShowCreateTableModal?.(db.id)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '4px 6px', fontSize: '12px', color: '#64748b', borderRadius: '6px' }}
                                    className="hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors font-medium mt-0.5"
                                  >
                                    <AnimatedPlus style={{ width: '12px', height: '12px' }} />
                                    <span>{t('nav.createTable')}</span>
                                  </button>
                                </SidebarMenuSubItem>
                              )}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* 3. Footer: User Profile Dropdown & System Actions */}
        <SidebarFooter style={{ height: '48px', minHeight: '48px', maxHeight: '48px', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }} className="border-t border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', padding: isSidebarCollapsed ? '0 4px' : '0 8px', borderRadius: '8px', height: '40px', minHeight: '40px', maxHeight: '40px' }}
                    className="hover:bg-slate-100 dark:hover:bg-slate-800 data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800 transition-colors"
                  >
                    <div
                      style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                    >
                      HD
                    </div>
                    {!isSidebarCollapsed && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            FYCD HD MANAGER
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {currentUser?.email || 'fycd2006@mail.ntut.edu.tw'}
                          </span>
                        </div>
                        <ChevronsUpDown style={{ width: '14px', height: '14px', marginLeft: 'auto', flexShrink: 0, color: '#94a3b8' }} />
                      </>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-60 rounded-xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                  side={isSidebarCollapsed ? 'right' : 'top'}
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                      <div
                        style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}
                      >
                        HD
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          FYCD HD MANAGER
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser?.email || 'fycd2006@mail.ntut.edu.tw'}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {onShowSubscriptionModal && (
                      <DropdownMenuItem onClick={onShowSubscriptionModal} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                        <Sparkles className="size-4 text-amber-500 shrink-0" />
                        <span style={{ color: 'inherit' }}>升級方案與授權</span>
                      </DropdownMenuItem>
                    )}
                    {onShowMembersModal && (
                      <DropdownMenuItem onClick={onShowMembersModal} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                        <Users className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
                        <span style={{ color: 'inherit' }}>{t('nav.members')}</span>
                      </DropdownMenuItem>
                    )}
                    {onShowNotificationsModal && (
                      <DropdownMenuItem onClick={onShowNotificationsModal} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                        <Bell className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
                        <span style={{ color: 'inherit' }}>{t('nav.notifications')}</span>
                      </DropdownMenuItem>
                    )}
                    {onShowUserSettingsModal && (
                      <DropdownMenuItem onClick={onShowUserSettingsModal} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                        <Settings className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
                        <span style={{ color: 'inherit' }}>帳號與偏好設定</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                      {theme === 'dark' ? <Sun className="size-4 text-amber-500 shrink-0" /> : <Moon className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />}
                      <span style={{ color: 'inherit' }}>{theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleDarkReaderPanel} className="cursor-pointer gap-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100">
                      <Sliders className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
                      <span style={{ color: 'inherit' }}>進階濾鏡調色盤</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="cursor-pointer gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span style={{ color: 'inherit' }}>登出系統</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
          <SidebarRail onClick={onToggleSidebarCollapse} />
        </Sidebar>
      </div>
    </SidebarProvider>
  )
}
