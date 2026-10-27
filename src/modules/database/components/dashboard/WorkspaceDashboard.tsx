'use client'

import React, { useState, useMemo } from 'react'
import type { User, Workspace, Database } from '@/modules/database/types'
import {
  Database as DatabaseIcon, Table as TableIcon, Users, Plus,
  FolderPlus, Layers, ChevronRight, Search, ArrowLeft, Pencil,
  FolderKanban, Briefcase, Wallet, ArrowRight, type LucideIcon
} from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'
import { MasterGridView } from '@/modules/database/components/views/master'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'
import { FycdLogo } from '@/components/brand/FycdLogo'
import { useHoverPrefetch } from '@/modules/database/cache/useHoverPrefetch'
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
  onTablePrefetch?: (tableId: number) => void
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
  theme?: 'light' | 'dark'
}

/**
 * 登入後首頁（工作區總覽）：Forest Land Glassmorphism 現代毛玻璃擬真風格
 */
export default function WorkspaceDashboard({
  currentUser,
  activeWorkspace,
  onSelectTable,
  onTablePrefetch,
  onShowMembersModal,
  onShowDatabaseModal,
  onShowCreateTableModal,
  onSetRenameType,
  onSetRenameId,
  onSetRenameNameValue,
  onShowRenameModal,
  onCreateFromTemplate,
  theme = 'light'
}: WorkspaceDashboardProps) {
  const { t } = useI18n()
  const getPrefetchHandlers = useHoverPrefetch(onTablePrefetch)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMasterView, setShowMasterView] = useState(false)
  const [isDeckExpanded, setIsDeckExpanded] = useState(false)
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
  const databases: Database[] = useMemo(() => activeWorkspace?.databases || [], [activeWorkspace?.databases])
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

  // 展開模式切換（搜尋中有輸入時自動視同展開）
  const showFullDeck = isDeckExpanded || isSearching

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
      {/* 左側大面積高霧度毛玻璃面板 (46% 聚焦 / 72% 全展開) */}
      <section className={`${styles.glassPanel} ${showFullDeck ? styles.glassPanelExpanded : ''}`}>
        
        {/* 表頭區：品牌字標、工作區名稱、歡迎文字與動作列 */}
        <div className={styles.topBar}>
          <div className={styles.identityRow}>
            <FycdLogo variant="full" height={18} tone={theme === 'dark' ? 'onDark' : 'brand'} />
            <h1 className={styles.title}>
              {activeWorkspace?.name || t('dashboard.cloudWorkspace')} {t('dashboard.overview')}
            </h1>
          </div>

          <div className={styles.topControls}>
            <LangPicker align="right" variant="dashboard" />
            {onShowMembersModal && (
              <button type="button" className={styles.glassBtnCapsule} onClick={onShowMembersModal}>
                <Users size={13} aria-hidden="true" />
                <span>{t('dashboard.membersCount', { count: memberCount })}</span>
              </button>
            )}

            {activeWorkspace && totalTablesCount > 0 && (
              <button
                type="button"
                className={styles.glassBtnCapsule}
                onClick={() => setShowMasterView(true)}
              >
                <Layers size={13} aria-hidden="true" />
                <span>{t('dashboard.masterView')}</span>
              </button>
            )}

            {activeWorkspace && onShowDatabaseModal && (
              <button
                type="button"
                className={styles.btnCreateDb}
                onClick={() => onShowDatabaseModal(activeWorkspace.id)}
              >
                <Plus size={13} aria-hidden="true" />
                <span>{t('dashboard.addDatabase')}</span>
              </button>
            )}
          </div>
        </div>

        {/* 歡迎列 */}
        <p className={styles.welcome}>
          {t('dashboard.welcomeLine', {
            username: currentUser.username,
            role: currentUser.role === 'admin' ? t('dashboard.adminRole') : t('dashboard.memberRole')
          })}
        </p>

        {/* 雙核心指標膠囊 */}
        <div className={styles.metricsDuo}>
          <div className={styles.metricCard}>
            <div>
              <div className={styles.metricLabel}>{t('dashboard.databaseCountLabel')}</div>
              <div className={styles.metricValue}>
                <SlidingNumber number={databases.length} inView={true} />
                <span className={styles.metricUnit}>{t('dashboard.databaseUnit')}</span>
              </div>
            </div>
            <div className={styles.metricIconCircle}>
              <DatabaseIcon size={18} aria-hidden="true" />
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
            <div className={styles.metricIconCircleOrange}>
              <TableIcon size={18} aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* 內容區：空工作區 或 資料庫清單卡片 */}
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
                <button
                  type="button"
                  className={styles.btnCreateDb}
                  onClick={() => onShowDatabaseModal(activeWorkspace.id)}
                >
                  {t('dashboard.createDatabase')}
                </button>

                {onCreateFromTemplate && (
                  <div className={styles.templates}>
                    {TEMPLATES.map(({ key, labelKey, icon: Icon }) => (
                      <button
                        key={key}
                        type="button"
                        className={styles.templateBtn}
                        onClick={() => onCreateFromTemplate(key)}
                      >
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
          <div className={styles.fullDbDeckView}>
            <div className={styles.deckHeaderRow}>
              <div className={styles.deckTitle}>
                <Layers size={18} aria-hidden="true" />
                <span>{t('dashboard.databaseList', { count: filteredDatabases.length })}</span>
              </div>
              <button
                type="button"
                className={styles.glassBtnCapsule}
                onClick={() => {
                  setIsDeckExpanded(prev => !prev)
                  if (isSearching) setSearchQuery('')
                }}
              >
                {showFullDeck ? (
                  <>
                    <ArrowLeft size={12} aria-hidden="true" />
                    <span>{t('dashboard.backToOverview')}</span>
                  </>
                ) : (
                  <>
                    <Layers size={12} aria-hidden="true" />
                    <span>展開全域檢視 (72%)</span>
                  </>
                )}
              </button>
            </div>

            <div className={styles.bentoDbGrid}>
              {filteredDatabases.map(db => {
                const tables = db.tables || []
                const expanded = isSearching || expandedDbIds.has(db.id)
                const visibleTables = expanded ? tables : tables.slice(0, TABLE_PREVIEW_LIMIT)
                const canToggle = !isSearching && tables.length > TABLE_PREVIEW_LIMIT

                return (
                  <div key={db.id} className={styles.bentoDbCard}>
                    <div className={styles.bCardHead}>
                      <div className={styles.bCardId}>
                        <div className={styles.bCardIcon}>
                          <DatabaseIcon size={14} aria-hidden="true" />
                        </div>
                        <div>
                          <div
                            className={styles.bCardName}
                            title={`${db.name} (${t('dashboard.doubleClickRename')})`}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              startRename('database', db.id, db.name)
                            }}
                          >
                            {db.name}
                          </div>
                          <div className={styles.bCardSub}>
                            {t('dashboard.tableCount', { count: tables.length })}
                          </div>
                        </div>
                        {onShowRenameModal && (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            aria-label={`${t('nav.renameDatabase')} - ${db.name}`}
                            title={t('nav.renameDatabase')}
                            onClick={(e) => {
                              e.stopPropagation()
                              startRename('database', db.id, db.name)
                            }}
                          >
                            <Pencil size={11} aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      {onShowCreateTableModal && (
                        <button
                          type="button"
                          className={styles.glassBtnCapsule}
                          onClick={() => onShowCreateTableModal(db.id)}
                        >
                          <Plus size={11} aria-hidden="true" />
                          <span>{t('dashboard.addTable')}</span>
                        </button>
                      )}
                    </div>

                    <div className={styles.bTableRows}>
                      {visibleTables.length > 0 ? (
                        visibleTables.map(tbl => (
                          <div key={tbl.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              className={styles.bTableRow}
                              onClick={() => onSelectTable(tbl.id)}
                              {...getPrefetchHandlers(tbl.id)}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TableIcon size={12} aria-hidden="true" />
                                <span>{tbl.name}</span>
                              </span>
                              <ChevronRight size={12} aria-hidden="true" />
                            </button>
                            {onShowRenameModal && (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                aria-label={`${t('nav.renameTable')} - ${tbl.name}`}
                                title={t('nav.renameTable')}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRename('table', tbl.id, tbl.name)
                                }}
                              >
                                <Pencil size={11} aria-hidden="true" />
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
                          {expandedDbIds.has(db.id)
                            ? t('dashboard.showLess')
                            : t('dashboard.showAllTables', { count: tables.length })}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* 右側開放全景區域：搜尋膠囊、垂直軌道字與跨表總表捷徑 */}
      <div className={styles.rightStageArea}>
        <div className={styles.pillSearchContainer}>
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            className={styles.pillSearchInput}
            aria-label={t('dashboard.searchPlaceholder')}
            placeholder={t('dashboard.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <ArrowRight size={13} aria-hidden="true" />
        </div>

        <div className={styles.verticalRailText}>
          OVERVIEW
        </div>

        {activeWorkspace && totalTablesCount > 0 && (
          <div
            className={styles.destFloatingCard}
            role="link"
            tabIndex={0}
            onClick={() => setShowMasterView(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setShowMasterView(true)
              }
            }}
          >
            <div className={styles.destCardIcon}>
              <Layers size={18} aria-hidden="true" />
            </div>
            <div>
              <div className={styles.destTitle}>{t('dashboard.masterView')}</div>
              <div className={styles.destMeta}>
                {t('dashboard.masterViewTitle', { workspace: activeWorkspace.name })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 跨界雙行超大主標題 ("FYCD" / "HD MANAGER") - 僅在第一無視覺出現 */}
      <div
        className={`${styles.heroHeadingContainer} ${showFullDeck ? styles.heroHeadingHidden : ''}`}
        aria-hidden="true"
      >
        <div className={styles.headingRow1}>
          <span className={styles.titleForest}>FYCD</span>
        </div>
        <div className={styles.headingRow2}>
          <span className={styles.titleLand}>HD MANAGER</span>
        </div>
      </div>
    </div>
  )
}
