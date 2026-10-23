'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Workspace, User } from '@/modules/database/types'
import { useHoverPrefetch } from '@/modules/database/cache/useHoverPrefetch'
import { useI18n } from '@/lib/i18n/i18nContext'
import { FycdLogo } from '@/components/brand/FycdLogo'
import styles from './Sidebar.module.css'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
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
  ArchiveRestore,
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

// 離開浮出的面板後延遲收回，容忍游標短暫滑出邊界
const PEEK_CLOSE_DELAY_MS = 250

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
  onOpenRecentlyDeleted?: () => void
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
  onTablePrefetch?: (tableId: number) => void
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
  onOpenRecentlyDeleted,
  onShowNotificationsModal,
  onShowUserSettingsModal,
  onShowSubscriptionModal,

  onToggleTheme,
  onLogout,
  onToggleDatabaseCollapse,
  onSetActiveWorkspaceId,
  onSetActiveTableId,
  onTablePrefetch,
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
  const getPrefetchHandlers = useHoverPrefetch(onTablePrefetch)

  // Drag and drop state for tables
  const [draggedItem, setDraggedItem] = useState<{ type: 'database' | 'table'; id: number; sourceDbId?: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ type: 'database' | 'table'; id: number } | null>(null)

  // 收合後只剩左上角一顆切換鈕；滑鼠碰到它才讓面板浮出（peek），離開面板後稍等再收回
  const [isPeeking, setIsPeeking] = useState(false)
  // 外部 prop 變更為展開時，於 render 期間重置 peeking 狀態
  const [prevCollapsed, setPrevCollapsed] = useState(isSidebarCollapsed)
  if (prevCollapsed !== isSidebarCollapsed) {
    setPrevCollapsed(isSidebarCollapsed)
    if (!isSidebarCollapsed && isPeeking) {
      setIsPeeking(false)
    }
  }

  const mode: 'docked' | 'collapsed' | 'peek' = !isSidebarCollapsed
    ? 'docked'
    : isPeeking
      ? 'peek'
      : 'collapsed'
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerInsideRef = useRef(false)
  const menuOpenRef = useRef(false)
  // 點收合鈕後游標通常還停在原位，需先移開一次才允許再次浮出
  const suppressPeekRef = useRef(false)

  const cancelPeekClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const schedulePeekClose = useCallback(() => {
    cancelPeekClose()
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      if (!pointerInsideRef.current && !menuOpenRef.current && !draggedItem) setIsPeeking(false)
    }, PEEK_CLOSE_DELAY_MS)
  }, [cancelPeekClose, draggedItem])

  useEffect(() => cancelPeekClose, [cancelPeekClose])

  useEffect(() => {
    if (!isSidebarCollapsed) {
      cancelPeekClose()
    }
  }, [isSidebarCollapsed, cancelPeekClose])

  useEffect(() => {
    if (mode !== 'peek') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !menuOpenRef.current) {
        cancelPeekClose()
        setIsPeeking(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, cancelPeekClose])

  // 側邊欄內的下拉選單是 portal，滑鼠移進選單會觸發面板 mouseleave；選單開著時不收回
  const handleMenuOpenChange = useCallback((open: boolean) => {
    menuOpenRef.current = open
    if (open) cancelPeekClose()
    else if (!pointerInsideRef.current) schedulePeekClose()
  }, [cancelPeekClose, schedulePeekClose])

  const toggleSidebar = useCallback((fromPointer: boolean) => {
    cancelPeekClose()
    setIsPeeking(false)
    suppressPeekRef.current = fromPointer && !isSidebarCollapsed
    onToggleSidebarCollapse?.()
  }, [cancelPeekClose, isSidebarCollapsed, onToggleSidebarCollapse])

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0]
  const canManageStructure = userPermissions?.canManageStructure ?? true

  const userInitials = (currentUser?.username || currentUser?.email || 'U').slice(0, 2).toUpperCase()

  const toggleLabel = isSidebarCollapsed ? (t('nav.expandSidebar') || '展開側邊欄') : (t('nav.collapseSidebar') || '收合側邊欄')
  const ToggleIcon = isSidebarCollapsed ? PanelLeftOpen : PanelLeftClose

  return (
    <SidebarProvider open={!isSidebarCollapsed} onOpenChange={() => toggleSidebar(false)}>
      <div
        className={`layout__col-1 ${styles.shell}`}
        data-sidebar-mode={mode}
        style={{ width: isSidebarCollapsed ? '0px' : '250px' }}
      >
        {/* 常駐在左上角頂層的單一切換按鈕（z-index 始終高於面板，側邊欄從底下滑出，絕不重複跳閃） */}
        <button
          type="button"
          data-sidebar-toggle=""
          title={`${toggleLabel} (Ctrl+B)`}
          aria-label={toggleLabel}
          aria-expanded={!isSidebarCollapsed}
          className={styles.toggleButton}
          onClick={(e) => {
            e.stopPropagation()
            toggleSidebar(e.detail > 0)
          }}
          onMouseEnter={() => {
            if (!isSidebarCollapsed || suppressPeekRef.current) return
            cancelPeekClose()
            setIsPeeking(true)
          }}
          onMouseLeave={() => {
            suppressPeekRef.current = false
            if (isSidebarCollapsed) schedulePeekClose()
          }}
        >
          <ToggleIcon style={{ width: '18px', height: '18px' }} />
        </button>

        <div
          data-sidebar-panel=""
          className={styles.panel}
          aria-hidden={mode === 'collapsed' ? true : undefined}
          inert={mode === 'collapsed'}
          onMouseEnter={() => {
            pointerInsideRef.current = true
            cancelPeekClose()
          }}
          onMouseLeave={() => {
            pointerInsideRef.current = false
            if (isSidebarCollapsed) schedulePeekClose()
          }}
        >
        <div className={styles.panelInner}>
        <Sidebar collapsible="none" className="w-full h-full border-none" style={{ background: 'transparent' }}>
          {/* 1. Header: Spacer for Top Toggle Button & Workspace Switcher */}
          <SidebarHeader style={{ height: '52px', minHeight: '52px', maxHeight: '52px', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '4px' }}>
              {/* 避讓頂層切換按鈕的佔位區（按鈕固定在 top: 10px, left: 8px） */}
              <div style={{ width: '32px', height: '32px', minWidth: '32px', flexShrink: 0 }} aria-hidden="true" />
              <SidebarMenu style={{ flex: 1, minWidth: 0 }}>
                <SidebarMenuItem>
                  <DropdownMenu onOpenChange={handleMenuOpenChange}>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        size="lg"
                        style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', padding: '0 8px', borderRadius: '8px', height: '42px', minHeight: '42px', maxHeight: '42px', justifyContent: 'flex-start' }}
                        className="hover:bg-[var(--bg-tertiary)] data-[state=open]:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <div
                          style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: 'var(--brand-green-main)', color: 'var(--text-inverse)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}
                          className="shadow-sm"
                        >
                          {activeWorkspace?.name?.[0]?.toUpperCase() || 'F'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {activeWorkspace?.name || 'FYCD 工作區'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {activeWorkspace?.databases?.length || 0} 個資料庫
                          </span>
                        </div>
                        <ChevronsUpDown style={{ width: '14px', height: '14px', marginLeft: 'auto', flexShrink: 0, color: 'var(--text-muted)' }} />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-64 rounded-xl shadow-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuLabel style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                          backgroundColor: isSelected ? 'var(--brand-green-light)' : undefined,
                        }}
                        className="hover:bg-[var(--bg-cell-hover)] focus:bg-[var(--bg-cell-hover)] data-[highlighted]:bg-[var(--bg-cell-hover)] transition-colors"
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          minWidth: '24px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid var(--brand-green-border)' : '1px solid var(--border-color)',
                          background: isSelected ? 'var(--brand-green-light)' : 'var(--bg-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          flexShrink: 0,
                          color: isSelected ? 'var(--brand-green-text)' : 'var(--text-secondary)'
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
                          color: isSelected ? 'var(--brand-green-text)' : 'var(--text-primary)'
                        }}>
                          {ws.name}
                        </div>
                        {isSelected && <Check style={{ width: '14px', height: '14px', color: 'var(--brand-green-text)', marginLeft: 'auto', flexShrink: 0 }} />}
                        <DropdownMenuShortcut style={{ marginLeft: isSelected ? '4px' : 'auto' }}>⌘{index + 1}</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  
                  {canManageStructure && (
                    <DropdownMenuItem
                      onClick={onShowWorkspaceModal}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', color: 'var(--brand-green-text)', fontWeight: 600, fontSize: '13px' }}
                      className="hover:bg-[var(--bg-cell-hover)]"
                    >
                      <div style={{ width: '24px', height: '24px', minWidth: '24px', borderRadius: '6px', border: '1px dashed var(--border-color)', background: 'var(--bg-cell-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--brand-green-text)' }}>
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
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}
                        className="hover:bg-[var(--bg-cell-hover)]"
                      >
                        <Pencil style={{ width: '13px', height: '13px' }} />
                        <span>重新命名當前工作區</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteWorkspaceOrDb('delete_workspace', activeWorkspace.id, activeWorkspace.name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--danger)' }}
                        className="hover:bg-[var(--bg-cell-hover)]"
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
                  className="data-[active=true]:bg-[var(--bg-cell-hover)] data-[active=true]:text-[var(--brand-green-text)] font-medium"
                >
                  <AnimatedHome style={{ width: '16px', height: '16px', minWidth: '16px', color: 'var(--brand-green-text)', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.home') || '首頁'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowNotificationsModal}
                >
                  <AnimatedBell style={{ width: '16px', height: '16px', minWidth: '16px', color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.notifications') || '通知中心'}</span>
                  {notificationCount > 0 && (
                    <SidebarMenuBadge style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)' }}>
                      {notificationCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onShowMembersModal}
                >
                  <AnimatedUsers style={{ width: '16px', height: '16px', minWidth: '16px', color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.members') || '成員管理'}</span>
                  {memberCount !== undefined && (
                    <SidebarMenuBadge style={{ color: 'var(--text-muted)' }}>
                      {memberCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {onOpenRecentlyDeleted && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onOpenRecentlyDeleted}
                  >
                    <ArchiveRestore style={{ width: '16px', height: '16px', minWidth: '16px', color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('nav.recentlyDeleted') || '最近刪除'}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1"
            >
              <span style={{ whiteSpace: 'nowrap' }}>資料庫清單</span>
              {canManageStructure && activeWorkspaceId && (
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
                    color: 'var(--text-muted)',
                    padding: 0,
                    transition: 'all 0.15s ease',
                  }}
                  className="hover:bg-[var(--bg-cell-hover)] hover:text-[var(--brand-green-text)] active:scale-95"
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
                              style={{ display: 'flex', alignItems: 'center', width: '100%', height: '32px', paddingLeft: '6px', paddingRight: canManageStructure ? '32px' : '8px' }}
                              className="font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                            >
                              <ChevronRight
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  minWidth: '14px',
                                  color: 'var(--text-muted)',
                                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                  transform: !isDbCollapsed ? 'rotate(90deg)' : 'none',
                                  marginRight: '4px',
                                  flexShrink: 0,
                                }}
                              />
                              <AnimatedDatabase style={{ width: '16px', height: '16px', minWidth: '16px', color: 'var(--brand-green-text)', flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '13px', marginLeft: '6px' }}>{db.name}</span>
                            </SidebarMenuButton>
                          </CollapsibleTrigger>

                          {/* Database Options Menu */}
                          {canManageStructure && (
                            <DropdownMenu onOpenChange={handleMenuOpenChange}>
                              <DropdownMenuTrigger asChild>
                                <SidebarMenuAction showOnHover style={{ top: '6px' }}>
                                  <MoreHorizontal style={{ width: '13px', height: '13px', minWidth: '13px' }} />
                                </SidebarMenuAction>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-44 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]">
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
                                  <Plus style={{ width: '14px', height: '14px', color: 'var(--brand-green-text)' }} />
                                  <span>{t('nav.createTable')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDeleteWorkspaceOrDb('delete_database', db.id, db.name)}
                                  className="cursor-pointer gap-2 text-[var(--danger)] hover:bg-[var(--bg-cell-hover)]"
                                >
                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                  <span>{t('nav.deleteDatabase')}</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        {/* Tables Submenu List */}
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
                                      className={`group/table-row group/sub-item ${dropTarget?.id === table.id ? 'border-t-2 border-[var(--brand-orange-main)] bg-[var(--brand-orange-light)]' : ''}`}
                                    >
                                      <SidebarMenuSubButton
                                        isActive={isActive}
                                        onClick={() => onSetActiveTableId(table.id)}
                                        {...getPrefetchHandlers(table.id)}
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
                                        className={`group/btn ${isActive ? 'text-[var(--brand-green-text)] font-semibold' : ''}`}
                                      >
                                        {isActive && (
                                          <motion.div
                                            layoutId="active-sidebar-table-indicator"
                                            className="absolute inset-0 rounded-md bg-[var(--bg-cell-hover)] border border-[var(--border-color)] pointer-events-none"
                                            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                                          />
                                        )}
                                        <AnimatedTable style={{ position: 'relative', zIndex: 1, width: '14px', height: '14px', minWidth: '14px', color: isActive ? 'var(--brand-green-text)' : 'var(--text-muted)', flexShrink: 0 }} />
                                        <span style={{ position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px', marginLeft: '6px' }}>{table.name}</span>
                                      </SidebarMenuSubButton>

                                      {/* Table Options Dropdown Action */}
                                      {canManageStructure && (
                                        <DropdownMenu onOpenChange={handleMenuOpenChange}>
                                          <DropdownMenuTrigger asChild>
                                            <SidebarMenuAction showOnHover>
                                              <MoreHorizontal style={{ width: '13px', height: '13px', minWidth: '13px' }} />
                                            </SidebarMenuAction>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent side="right" align="start" className="w-40 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]">
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
                                                  className="cursor-pointer gap-2 text-[var(--danger)] hover:bg-[var(--bg-cell-hover)]"
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
                                <div className="px-2 py-1 text-xs text-[var(--text-muted)] italic">
                                  無資料表
                                </div>
                              )}

                              {/* Create Table Quick Button */}
                              {canManageStructure && (
                                <SidebarMenuSubItem style={{ width: '100%' }}>
                                  <button
                                    onClick={() => onShowCreateTableModal?.(db.id)}
                                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '4px 6px', fontSize: '12px', color: 'var(--text-muted)', borderRadius: '6px' }}
                                    className="hover:text-[var(--brand-green-text)] hover:bg-[var(--bg-tertiary)] transition-colors font-medium mt-0.5"
                                  >
                                    <AnimatedPlus style={{ width: '12px', height: '12px' }} />
                                    <span>{t('nav.createTable')}</span>
                                  </button>
                                </SidebarMenuSubItem>
                              )}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* 3. Footer: User Profile Dropdown & System Actions */}
        <SidebarFooter style={{ height: '52px', minHeight: '52px', maxHeight: '52px', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu onOpenChange={handleMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', padding: '0 8px', borderRadius: '8px', height: '40px', minHeight: '40px', maxHeight: '40px' }}
                    className="hover:bg-[var(--bg-tertiary)] data-[state=open]:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <div
                      style={{ width: '28px', height: '28px', minWidth: '28px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}
                    >
                      <FycdLogo variant="icon" height={10} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        FYCD HD MANAGER
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {currentUser?.email || 'fycd2006@mail.ntut.edu.tw'}
                      </span>
                    </div>
                    <ChevronsUpDown style={{ width: '14px', height: '14px', marginLeft: 'auto', flexShrink: 0, color: 'var(--text-muted)' }} />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-60 rounded-xl shadow-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)]"
                  side="top"
                  align="end"
                  sideOffset={8}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' }}>
                      <div
                        style={{ width: '32px', height: '32px', minWidth: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxSizing: 'border-box' }}
                      >
                        <FycdLogo variant="icon" height={12} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', textAlign: 'left', minWidth: 0, gap: '1px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          FYCD HD MANAGER
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser?.email || 'fycd2006@mail.ntut.edu.tw'}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {onShowSubscriptionModal && (
                      <DropdownMenuItem onClick={onShowSubscriptionModal} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                        <Sparkles className="size-4 text-amber-500 shrink-0" />
                        <span style={{ color: 'inherit' }}>升級方案與授權</span>
                      </DropdownMenuItem>
                    )}
                    {onShowMembersModal && (
                      <DropdownMenuItem onClick={onShowMembersModal} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                        <Users className="size-4 text-[var(--text-muted)] shrink-0" />
                        <span style={{ color: 'inherit' }}>{t('nav.members')}</span>
                      </DropdownMenuItem>
                    )}
                    {onShowNotificationsModal && (
                      <DropdownMenuItem onClick={onShowNotificationsModal} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                        <Bell className="size-4 text-[var(--text-muted)] shrink-0" />
                        <span style={{ color: 'inherit' }}>{t('nav.notifications')}</span>
                      </DropdownMenuItem>
                    )}
                    {onShowUserSettingsModal && (
                      <DropdownMenuItem onClick={onShowUserSettingsModal} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                        <Settings className="size-4 text-[var(--text-muted)] shrink-0" />
                        <span style={{ color: 'inherit' }}>帳號與偏好設定</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                      {theme === 'dark' ? <Sun className="size-4 text-amber-500 shrink-0" /> : <Moon className="size-4 text-[var(--text-muted)] shrink-0" />}
                      <span style={{ color: 'inherit' }}>{theme === 'dark' ? '切換為亮色模式' : '切換為深色模式'}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleDarkReaderPanel} className="cursor-pointer gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-cell-hover)]">
                      <Sliders className="size-4 text-[var(--text-muted)] shrink-0" />
                      <span style={{ color: 'inherit' }}>進階濾鏡調色盤</span>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onLogout}
                    className="cursor-pointer gap-2 text-[var(--danger)] hover:bg-[var(--bg-cell-hover)]"
                  >
                    <LogOut className="size-4 shrink-0 text-[var(--danger)]" />
                    <span style={{ color: 'inherit' }}>登出系統</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        </Sidebar>
        </div>
        </div>
      </div>
    </SidebarProvider>
  )
}
