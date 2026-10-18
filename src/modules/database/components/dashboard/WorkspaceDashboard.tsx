'use client'

import React, { useState, useMemo } from 'react'
import type { User, Workspace, Database } from '@/modules/database/types'
import { 
  Database as DatabaseIcon, Table as TableIcon, Users, Plus, 
  Sparkles, FolderPlus, Layers, ChevronRight, Search,
  ArrowUpRight, ShieldCheck, Activity, Filter, Command,
  ArrowRight, ArrowLeft, Clock, Zap, Pencil, Trash2
} from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'
import { MasterGridView } from '@/modules/database/components/views/master'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { FycdLogo } from '@/components/brand/FycdLogo'

/** 每張資料庫卡片預設顯示的資料表數；搜尋中不套用 */
const TABLE_PREVIEW_LIMIT = 5

interface WorkspaceDashboardProps {
  currentUser: User
  activeWorkspace: Workspace | null
  workspaces: Workspace[]
  onSelectTable: (tableId: number) => void
  onShowMembersModal?: () => void
  onShowDatabaseModal?: (wsId: number) => void
  onShowCreateTableModal?: (dbId: number) => void
  onSetRenameType?: (type: 'workspace' | 'database' | 'table') => void
  onSetRenameId?: (id: number) => void
  onSetRenameNameValue?: (val: string) => void
  onShowRenameModal?: () => void
  onDeleteWorkspaceOrDb?: (action: 'delete_workspace' | 'delete_database', id: number, label: string) => void
  onDeleteTable?: (tableId: number, tableName: string) => void
  onCreateFromTemplate?: (templateKey: 'project' | 'crm' | 'finance' | 'hr') => void
}

/**
 * Design Read:
 * "Reading this as: No-Code Cloud Database Workspace Dashboard for technical & business teams,
 * with a Linear-style minimalist & data-dense language, leaning toward Geist/Satoshi aesthetics,
 * subtle micro-interactions, crisp monochrome layout with electric blue accent lock."
 * Dials: DESIGN_VARIANCE: 7 | MOTION_INTENSITY: 6 | VISUAL_DENSITY: 4
 */
export default function WorkspaceDashboard({
  currentUser,
  activeWorkspace,
  workspaces,
  onSelectTable,
  onShowMembersModal,
  onShowDatabaseModal,
  onShowCreateTableModal,
  onSetRenameType,
  onSetRenameId,
  onSetRenameNameValue,
  onShowRenameModal,
  onDeleteWorkspaceOrDb,
  onDeleteTable,
  onCreateFromTemplate
}: WorkspaceDashboardProps) {
  const { t } = useI18n()
  const [searchQuery, setSearchQuery] = useState('')
  const [showMasterView, setShowMasterView] = useState(false)
  const [expandedDbIds, setExpandedDbIds] = useState<Set<number>>(() => new Set())
  const isSearching = searchQuery.trim().length > 0

  const toggleExpanded = (dbId: number) => {
    setExpandedDbIds(prev => {
      const next = new Set(prev)
      if (next.has(dbId)) next.delete(dbId)
      else next.add(dbId)
      return next
    })
  }

  // Calculate statistics
  const databases: Database[] = activeWorkspace?.databases || []
  const totalTablesCount = useMemo(() => {
    return databases.reduce((acc, db) => acc + (db.tables?.length || 0), 0)
  }, [databases])

  const tablesMap = useMemo(() => {
    const map: Record<number, { name: string; color?: string }> = {}
    databases.forEach(db => {
      (db.tables || []).forEach(tbl => {
        map[tbl.id] = { name: tbl.name, color: '#4f46e5' }
      })
    })
    return map
  }, [databases])

  const memberCount = activeWorkspace?.members?.length || 1

  // Filter databases & tables based on search query
  const filteredDatabases = useMemo(() => {
    if (!searchQuery.trim()) return databases
    const q = searchQuery.toLowerCase().trim()
    return databases.map(db => {
      const dbMatch = db.name.toLowerCase().includes(q)
      const matchingTables = (db.tables || []).filter(t => t.name.toLowerCase().includes(q))
      if (dbMatch) return db
      if (matchingTables.length > 0) {
        return { ...db, tables: matchingTables }
      }
      return null
    }).filter(Boolean) as Database[]
  }, [databases, searchQuery])

  if (showMasterView && activeWorkspace) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '8px 16px', backgroundColor: '#f4f4f5', borderBottom: '1px solid #E7E1D3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setShowMasterView(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid #d4d4d8', borderRadius: '6px', backgroundColor: '#ffffff', fontSize: '12px', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>{t('dashboard.backToOverview')}</span>
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#3f3f46' }}>
            {t('dashboard.masterViewTitle', { workspace: activeWorkspace.name })}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MasterGridView
            workspaceId={activeWorkspace.id}
            workspaceName={activeWorkspace.name}
            tablesMap={tablesMap}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      height: '100%',
      backgroundColor: '#FAF8F3',
      fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#09090b',
      boxSizing: 'border-box'
    }}>
      <style>{`
        .workspace-dashboard-inner {
          max-width: 1240px;
          margin: 0 auto;
          padding: 40px 32px 80px 32px;
          display: flex;
          flex-direction: column;
          gap: 36px;
        }
        @media (max-width: 768px) {
          .workspace-dashboard-inner {
            padding: 20px 16px max(100px, calc(env(safe-area-inset-bottom) + 80px)) 16px !important;
            gap: 20px !important;
          }
          .workspace-dashboard-header-actions {
            width: 100% !important;
            flex-wrap: wrap !important;
          }
          .workspace-dashboard-header-actions > * {
            flex: 1 1 calc(50% - 6px) !important;
          }
        }
      `}</style>
      <div className="workspace-dashboard-inner">
        
        {/* Top Header / Workspace Identity Strip */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid #E7E1D3',
          paddingBottom: '24px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <FycdLogo variant="full" height={18} />
                <h1 style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  margin: 0,
                  color: '#09090b',
                  lineHeight: 1.2
                }}>
                  {activeWorkspace?.name || t('dashboard.cloudWorkspace')} {t('dashboard.overview')}
                </h1>
              </div>
            </div>

            <p style={{
              fontSize: '13px',
              color: '#71717a',
              margin: 0,
              lineHeight: 1.5
            }}>
              {t('dashboard.welcomeLine', { username: currentUser.username, role: currentUser.role === 'admin' ? t('dashboard.adminRole') : t('dashboard.memberRole') })}
            </p>
          </div>

          <div className="workspace-dashboard-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <LangPicker align="right" variant="dashboard" />
            {onShowMembersModal && (
              <button
                onClick={onShowMembersModal}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#27272a',
                  border: '1px solid #E7E1D3',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f4f4f5'
                  e.currentTarget.style.borderColor = '#d4d4d8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.borderColor = '#E7E1D3'
                }}
              >
                <Users size={15} color="#52525b" /> {t('dashboard.membersCount', { count: memberCount })}
              </button>
            )}

            {activeWorkspace && totalTablesCount > 0 && (
              <button
                onClick={() => setShowMasterView(true)}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#39452B',
                  border: '1px solid rgba(57, 69, 43, 0.4)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(57, 69, 43, 0.06)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#EEF0E8'
                  e.currentTarget.style.borderColor = '#39452B'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.borderColor = 'rgba(57, 69, 43, 0.4)'
                }}
              >
                <Layers size={15} color="#39452B" />
                <span>{t('dashboard.masterView')}</span>
              </button>
            )}

            {activeWorkspace && onShowDatabaseModal && (
              <button
                onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                className="h-9 px-3.5 rounded-lg bg-[#39452B] hover:bg-[#2C3621] text-white font-semibold text-xs tracking-tight transition-all duration-200 active:scale-[0.98] shadow-md shadow-[#39452B]/25 flex items-center gap-1.5 cursor-pointer border-none whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('dashboard.addDatabase')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Minimalist Linear-Style Data Metrics (2 Balanced Metric Cards) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {/* Metric 1: Database Count */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #E7E1D3',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('dashboard.databaseCountLabel')}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090b', marginTop: '4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline' }}>
                <SlidingNumber number={databases.length} inView={true} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#71717a', marginLeft: '6px' }}>{t('dashboard.databaseUnit')}</span>
              </div>
            </div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#EEF0E8',
              color: '#39452B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <DatabaseIcon size={20} />
            </div>
          </div>

          {/* Metric 2: Total Tables */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #E7E1D3',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('dashboard.tableCountLabel')}
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#09090b', marginTop: '4px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline' }}>
                <SlidingNumber number={totalTablesCount} inView={true} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#71717a', marginLeft: '6px' }}>{t('dashboard.tableUnit')}</span>
              </div>
            </div>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#FFF1E5',
              color: '#DD6410',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TableIcon size={20} />
            </div>
          </div>
        </div>

        {/* Database & Table Explorer Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section Bar + Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#09090b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '-0.01em'
            }}>
              <Layers size={18} color="#39452B" /> {t('dashboard.databaseList', { count: filteredDatabases.length })}
            </h2>

            {/* Clean Command Search Bar */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={15} color="#a1a1aa" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={t('dashboard.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px 0 36px',
                  borderRadius: '8px',
                  border: '1px solid #E7E1D3',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#09090b',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#39452B'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(63, 98, 18,0.1)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E7E1D3'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>
          </div>

          {/* Database Grid Cards */}
          {filteredDatabases.length === 0 ? (
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px dashed #d4d4d8',
              padding: '50px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: '#f4f4f5',
                color: '#71717a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FolderPlus size={24} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#18181b' }}>
                {searchQuery ? t('dashboard.noMatchTitle', { query: searchQuery }) : t('dashboard.emptyTitle')}
              </div>
              <div style={{ fontSize: '13px', color: '#71717a', maxWidth: '380px' }}>
                {searchQuery ? t('dashboard.noMatchSub') : t('dashboard.emptySub')}
              </div>
              {activeWorkspace && onShowDatabaseModal && !searchQuery && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                  <button
                    onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      backgroundColor: '#18181B',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {t('dashboard.createDatabase')}
                  </button>
                  
                  {onCreateFromTemplate && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        onClick={() => onCreateFromTemplate('project')}
                        style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#e0f2fe', color: '#0284c7', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        {t('dashboard.templateProject')}
                      </button>
                      <button
                        onClick={() => onCreateFromTemplate('crm')}
                        style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#fce7f3', color: '#db2777', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        {t('dashboard.templateCrm')}
                      </button>
                      <button
                        onClick={() => onCreateFromTemplate('finance')}
                        style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#16a34a', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        {t('dashboard.templateFinance')}
                      </button>
                      <button
                        onClick={() => onCreateFromTemplate('hr')}
                        style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#d97706', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                      >
                        {t('dashboard.templateHr')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '20px'
            }}>
              {filteredDatabases.map(db => {
                const tables = db.tables || []
                const expanded = isSearching || expandedDbIds.has(db.id)
                const visibleTables = expanded ? tables : tables.slice(0, TABLE_PREVIEW_LIMIT)
                const canToggle = !isSearching && tables.length > TABLE_PREVIEW_LIMIT
                return (
                <div
                  key={db.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #E7E1D3',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E7E1D3'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                  }}
                >
                  {/* Database Card Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: '#F4F4F5',
                        color: '#18181B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <DatabaseIcon size={18} color="#39452B" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <h3
                            style={{
                              fontSize: '15px',
                              fontWeight: 700,
                              color: '#0f172a',
                              margin: 0,
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer'
                            }}
                            title={`${db.name} (${t('dashboard.doubleClickRename')})`}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              if (onSetRenameType && onSetRenameId && onSetRenameNameValue && onShowRenameModal) {
                                onSetRenameType('database')
                                onSetRenameId(db.id)
                                onSetRenameNameValue(db.name)
                                onShowRenameModal()
                              }
                            }}
                          >
                            {db.name}
                          </h3>
                          {onShowRenameModal && (
                            <button
                              type="button"
                              title={t('nav.renameDatabase')}
                              aria-label={t('nav.renameDatabase')}
                              onClick={(e) => {
                                e.stopPropagation()
                                onSetRenameType?.('database')
                                onSetRenameId?.(db.id)
                                onSetRenameNameValue?.(db.name)
                                onShowRenameModal?.()
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: '2px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#39452B')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500, marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {t('dashboard.tableCount', { count: db.tables?.length || 0 })}
                        </span>
                      </div>
                    </div>

                    {onShowCreateTableModal && (
                      <button
                        type="button"
                        onClick={() => onShowCreateTableModal(db.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F4F4F5'
                          e.currentTarget.style.borderColor = '#E4E4E7'
                          e.currentTarget.style.color = '#39452B'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f1f5f9'
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.color = '#334155'
                        }}
                      >
                        <Plus size={14} />
                        <span>{t('dashboard.addTable')}</span>
                      </button>
                    )}
                  </div>

                  {/* Table Item List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    borderTop: '1px solid #f4f4f5',
                    paddingTop: '12px'
                  }}>
                    {visibleTables.length > 0 ? (
                      visibleTables.map(table => (
                        <div key={table.id} className="tableRow" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="tableOpen"
                            onClick={() => onSelectTable(table.id)}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              if (onSetRenameType && onSetRenameId && onSetRenameNameValue && onShowRenameModal) {
                                onSetRenameType('table')
                                onSetRenameId(table.id)
                                onSetRenameNameValue(table.name)
                                onShowRenameModal()
                              }
                            }}
                            title={`${table.name} (${t('dashboard.doubleClickRename')})`}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, padding: '8px 12px', fontSize: '13px', fontWeight: 600, textAlign: 'left' }}
                          >
                            <TableIcon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {table.name}
                            </span>
                            <ChevronRight size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                          </button>
                          {onShowRenameModal && (
                            <button
                              type="button"
                              className="iconBtn"
                              aria-label={t('nav.renameTable')}
                              title={t('nav.renameTable')}
                              onClick={() => {
                                onSetRenameType?.('table')
                                onSetRenameId?.(table.id)
                                onSetRenameNameValue?.(table.name)
                                onShowRenameModal?.()
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{
                        fontSize: '12px',
                        color: '#a1a1aa',
                        padding: '8px 0',
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        {t('dashboard.emptyTable')}
                      </div>
                    )}
                    {canToggle && (
                      <button
                        type="button"
                        className="showMore"
                        aria-expanded={expandedDbIds.has(db.id)}
                        onClick={() => toggleExpanded(db.id)}
                        style={{ alignSelf: 'flex-start', padding: '4px 12px', fontSize: '12px', fontWeight: 600 }}
                      >
                        {expandedDbIds.has(db.id) ? t('dashboard.showLess') : t('dashboard.showAllTables', { count: tables.length })}
                      </button>
                    )}
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
