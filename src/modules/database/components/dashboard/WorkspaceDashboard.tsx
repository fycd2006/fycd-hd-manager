'use client'

import React, { useState, useMemo } from 'react'
import type { User, Workspace, Database } from '@/modules/database/types'
import {
  Database as DatabaseIcon, Table as TableIcon, Users, Plus,
  FolderPlus, Layers, ChevronRight, Search, ArrowLeft, Pencil,
  FolderKanban, Briefcase, Wallet, type LucideIcon
} from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'
import { MasterGridView } from '@/modules/database/components/views/master'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { FycdLogo } from '@/components/brand/FycdLogo'
import styles from './WorkspaceDashboard.module.css'

/** 每張資料庫卡片預設顯示的資料表數；搜尋中不套用 */
const TABLE_PREVIEW_LIMIT = 5

type TemplateKey = 'project' | 'crm' | 'finance' | 'hr'

const TEMPLATES: { key: TemplateKey; labelKey: string; icon: LucideIcon }[] = [
  { key: 'project', labelKey: 'dashboard.templateProject', icon: FolderKanban },
  { key: 'crm', labelKey: 'dashboard.templateCrm', icon: Briefcase },
  { key: 'finance', labelKey: 'dashboard.templateFinance', icon: Wallet },
  { key: 'hr', labelKey: 'dashboard.templateHr', icon: Users },
]

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
  onCreateFromTemplate?: (templateKey: TemplateKey) => void
}

/**
 * 登入後首頁（工作區總覽）：FYCD 暖米白底、深綠主色、橘色強調。
 * 配色只用 WorkspaceDashboard.module.css 的 --dash-* 變數，暗色由外層 .theme-dark 覆寫。
 */
export default function WorkspaceDashboard({
  currentUser,
  activeWorkspace,
  onSelectTable,
  onShowMembersModal,
  onShowDatabaseModal,
  onShowCreateTableModal,
  onSetRenameType,
  onSetRenameId,
  onSetRenameNameValue,
  onShowRenameModal,
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
        map[tbl.id] = { name: tbl.name }
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

  const startRename = (type: 'database' | 'table', id: number, name: string) => {
    if (!onShowRenameModal) return
    onSetRenameType?.(type)
    onSetRenameId?.(id)
    onSetRenameNameValue?.(name)
    onShowRenameModal()
  }

  if (showMasterView && activeWorkspace) {
    return (
      <div className={styles.masterRoot}>
        <div className={styles.masterBar}>
          <button type="button" className={styles.masterBack} onClick={() => setShowMasterView(false)}>
            <ArrowLeft size={14} aria-hidden="true" />
            <span>{t('dashboard.backToOverview')}</span>
          </button>
          <span className={styles.masterTitle}>
            {t('dashboard.masterViewTitle', { workspace: activeWorkspace.name })}
          </span>
        </div>
        <div className={styles.masterBody}>
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
    <div className={styles.root}>
      <div className={styles.inner}>

        {/* 表頭：品牌字標、工作區標題、歡迎列 */}
        <header className={styles.header}>
          <div className={styles.identity}>
            <FycdLogo variant="full" height={18} />
            <h1 className={styles.title}>
              {activeWorkspace?.name || t('dashboard.cloudWorkspace')} {t('dashboard.overview')}
            </h1>
            <p className={styles.welcome}>
              {t('dashboard.welcomeLine', { username: currentUser.username, role: currentUser.role === 'admin' ? t('dashboard.adminRole') : t('dashboard.memberRole') })}
            </p>
          </div>

          <div className={styles.actions}>
            <LangPicker align="right" variant="dashboard" />
            {onShowMembersModal && (
              <button type="button" className={styles.btnSecondary} onClick={onShowMembersModal}>
                <Users size={15} aria-hidden="true" /> {t('dashboard.membersCount', { count: memberCount })}
              </button>
            )}

            {activeWorkspace && totalTablesCount > 0 && (
              <button type="button" className={styles.btnOutline} onClick={() => setShowMasterView(true)}>
                <Layers size={15} aria-hidden="true" />
                <span>{t('dashboard.masterView')}</span>
              </button>
            )}

            {activeWorkspace && onShowDatabaseModal && (
              <button type="button" className={styles.btnPrimary} onClick={() => onShowDatabaseModal(activeWorkspace.id)}>
                <Plus size={14} aria-hidden="true" />
                <span>{t('dashboard.addDatabase')}</span>
              </button>
            )}
          </div>
        </header>

        {/* 指標卡 */}
        <div className={styles.metrics}>
          <div className={styles.metricCard}>
            <div>
              <div className={styles.metricLabel}>{t('dashboard.databaseCountLabel')}</div>
              <div className={styles.metricValue}>
                <SlidingNumber number={databases.length} inView={true} />
                <span className={styles.metricUnit}>{t('dashboard.databaseUnit')}</span>
              </div>
            </div>
            <div className={styles.metricIcon}>
              <DatabaseIcon size={20} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.metricCard}>
            <div>
              <div className={styles.metricLabel}>{t('dashboard.tableCountLabel')}</div>
              <div className={styles.metricValue}>
                <SlidingNumber number={totalTablesCount} inView={true} />
                <span className={styles.metricUnit}>{t('dashboard.tableUnit')}</span>
              </div>
            </div>
            <div className={styles.metricIconAccent}>
              <TableIcon size={20} aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* 資料庫與資料表 */}
        <section className={styles.section}>
          <div className={styles.sectionBar}>
            <h2 className={styles.sectionTitle}>
              <Layers size={18} aria-hidden="true" /> {t('dashboard.databaseList', { count: filteredDatabases.length })}
            </h2>

            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} aria-hidden="true" />
              <input
                type="text"
                className={styles.search}
                placeholder={t('dashboard.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredDatabases.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <FolderPlus size={24} aria-hidden="true" />
              </div>
              <div className={styles.emptyTitle}>
                {searchQuery ? t('dashboard.noMatchTitle', { query: searchQuery }) : t('dashboard.emptyTitle')}
              </div>
              <div className={styles.emptySub}>
                {searchQuery ? t('dashboard.noMatchSub') : t('dashboard.emptySub')}
              </div>
              {activeWorkspace && onShowDatabaseModal && !searchQuery && (
                <div className={styles.emptyActions}>
                  <button type="button" className={styles.btnPrimary} onClick={() => onShowDatabaseModal(activeWorkspace.id)}>
                    {t('dashboard.createDatabase')}
                  </button>

                  {onCreateFromTemplate && (
                    <div className={styles.templates}>
                      {TEMPLATES.map(({ key, labelKey, icon: Icon }) => (
                        <button key={key} type="button" className={styles.templateBtn} onClick={() => onCreateFromTemplate(key)}>
                          <Icon size={14} aria-hidden="true" />
                          <span>{t(labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredDatabases.map(db => {
                const tables = db.tables || []
                const expanded = isSearching || expandedDbIds.has(db.id)
                const visibleTables = expanded ? tables : tables.slice(0, TABLE_PREVIEW_LIMIT)
                const canToggle = !isSearching && tables.length > TABLE_PREVIEW_LIMIT
                return (
                  <div key={db.id} className={styles.dbCard}>
                    <div className={styles.dbHeader}>
                      <div className={styles.dbIdentity}>
                        <div className={styles.dbIcon}>
                          <DatabaseIcon size={18} aria-hidden="true" />
                        </div>
                        <div className={styles.dbText}>
                          <div className={styles.dbNameRow}>
                            <h3
                              className={styles.dbName}
                              title={`${db.name} (${t('dashboard.doubleClickRename')})`}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                startRename('database', db.id, db.name)
                              }}
                            >
                              {db.name}
                            </h3>
                            {onShowRenameModal && (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title={t('nav.renameDatabase')}
                                aria-label={t('nav.renameDatabase')}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRename('database', db.id, db.name)
                                }}
                              >
                                <Pencil size={13} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                          <span className={styles.dbMeta}>
                            {t('dashboard.tableCount', { count: tables.length })}
                          </span>
                        </div>
                      </div>

                      {onShowCreateTableModal && (
                        <button type="button" className={styles.addTableBtn} onClick={() => onShowCreateTableModal(db.id)}>
                          <Plus size={14} aria-hidden="true" />
                          <span>{t('dashboard.addTable')}</span>
                        </button>
                      )}
                    </div>

                    <div className={styles.tableList}>
                      {visibleTables.length > 0 ? (
                        visibleTables.map(table => (
                          <div key={table.id} className={styles.tableRow}>
                            <button
                              type="button"
                              className={styles.tableOpen}
                              onClick={() => onSelectTable(table.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                startRename('table', table.id, table.name)
                              }}
                              title={`${table.name} (${t('dashboard.doubleClickRename')})`}
                            >
                              <TableIcon size={14} aria-hidden="true" />
                              <span className={styles.tableName}>{table.name}</span>
                              <ChevronRight size={14} className={styles.chevron} aria-hidden="true" />
                            </button>
                            {onShowRenameModal && (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                aria-label={t('nav.renameTable')}
                                title={t('nav.renameTable')}
                                onClick={() => startRename('table', table.id, table.name)}
                              >
                                <Pencil size={13} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className={styles.emptyTable}>
                          {t('dashboard.emptyTable')}
                        </div>
                      )}
                      {canToggle && (
                        <button
                          type="button"
                          className={styles.showMore}
                          aria-expanded={expandedDbIds.has(db.id)}
                          onClick={() => toggleExpanded(db.id)}
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
        </section>

      </div>
    </div>
  )
}
