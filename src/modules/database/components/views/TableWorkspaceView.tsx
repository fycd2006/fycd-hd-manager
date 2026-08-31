'use client'

import React from 'react'
import { ViewToolbar } from '@/modules/database/components/toolbar/ViewToolbar'
import DatabaseViewRouter from '@/modules/database/components/views/DatabaseViewRouter'
import PullToRefresh from '@/components/ui/PullToRefresh'
import { useTableContext } from '@/modules/database/context/TableContext'
import type {
  User,
  Workspace,
  TableView,
  GroupCollapseState,
  SortRule,
  FilterRule,
  RowColorRule,
  GroupByRule,
} from '@/modules/database/types'

export interface TableWorkspaceViewProps {
  isSidebarCollapsed: boolean
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>> | ((v: boolean) => void)
  currentUserRolePermissions: {
    canManageStructure?: boolean
    canEditData?: boolean
    canManageViews?: boolean
    canViewData?: boolean
  }
  currentUser: User | null
  activeWorkspaceId: number | null
  workspaces: Workspace[]
  unreadNotificationsCount?: number

  // Toolbar & Filter states
  searchQuery: string
  setSearchQuery: (query: string) => void
  sortField: string | null
  setSortField: (field: string | null) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (order: 'asc' | 'desc') => void
  filterType: 'AND' | 'OR'
  setFilterType: (type: 'AND' | 'OR') => void
  groupByField: string | null
  setGroupByField: (field: string | null) => void
  groupCollapseState: GroupCollapseState
  setGroupCollapseState: React.Dispatch<React.SetStateAction<GroupCollapseState>>
  rowHeightSize: 'small' | 'medium' | 'large' | 'extra'
  setRowHeightSize: (size: 'small' | 'medium' | 'large' | 'extra') => void
  frozenColumnsCount: number

  // Handlers & Callbacks
  applyViewConfig: (view: TableView) => void
  handleDuplicateView: (viewId: number) => void
  handleDeleteViewById: (viewId: number) => void
  handleRenameViewById: (viewId: number) => void
  handleExportCSV: () => void
  handleCSVImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  csvInputRef: React.RefObject<HTMLInputElement | null>
  setShowAirtableModal: (show: boolean) => void
  setShowNewViewModal: (show: boolean) => void
  setShowMembersModal: (show: boolean) => void
  setShowNotificationsModal: (show: boolean) => void
  setShowUserSettingsModal: (show: boolean) => void
  toggleTheme: () => void
  toggleDarkReaderPanel: () => void
  logout: () => void
  canUndo: boolean
  canRedo: boolean
  undo: (tableId?: number | null) => void
  redo: (tableId?: number | null) => void

  // Field & Cell Interactions
  editingFieldId: number | null
  setEditingFieldId: (id: number | null) => void
  editingFieldName: string
  setEditingFieldName: (name: string) => void
  editingCell: { rowId: number; fieldKey: string } | null
  editInputRef: React.RefObject<HTMLInputElement | null>
  handleColumnDragStart: (e: React.DragEvent, fieldId: number) => void
  handleColumnDragOver: (e: React.DragEvent) => void
  handleColumnDrop: (e: React.DragEvent, targetFieldId: number) => void
  handleReorderRows: (sourceIndex: number, targetIndex: number) => Promise<void>
  setContextMenu: (menu: any) => void
  setNewFieldPopoverPos: (pos: { top: number; left: number }) => void
  onSelectDashboard: () => void
  onSetActiveWorkspaceId: (id: number) => void
  onSetActiveTableId: (id: number) => void
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  isOffline?: boolean
  newFieldScrollTrigger?: number
}

export const TableWorkspaceView: React.FC<TableWorkspaceViewProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  currentUserRolePermissions,
  currentUser,
  activeWorkspaceId,
  workspaces,
  unreadNotificationsCount = 0,
  searchQuery,
  setSearchQuery,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  filterType,
  setFilterType,
  groupByField,
  setGroupByField,
  groupCollapseState,
  setGroupCollapseState,
  rowHeightSize,
  setRowHeightSize,
  frozenColumnsCount,
  applyViewConfig,
  handleDuplicateView,
  handleDeleteViewById,
  handleRenameViewById,
  handleExportCSV,
  handleCSVImport,
  csvInputRef,
  setShowAirtableModal,
  setShowNewViewModal,
  setShowMembersModal,
  setShowNotificationsModal,
  setShowUserSettingsModal,
  toggleTheme,
  toggleDarkReaderPanel,
  logout,
  canUndo,
  canRedo,
  undo,
  redo,
  editingFieldId,
  setEditingFieldId,
  editingFieldName,
  setEditingFieldName,
  editingCell,
  editInputRef,
  handleColumnDragStart,
  handleColumnDragOver,
  handleColumnDrop,
  handleReorderRows,
  setContextMenu,
  setNewFieldPopoverPos,
  onSelectDashboard,
  onSetActiveWorkspaceId,
  onSetActiveTableId,
  addToast,
  isOffline,
  newFieldScrollTrigger,
}) => {
  const tableCtx = useTableContext()
  const {
    activeTableId,
    activeViewId,
    views,
    fields,
    rows,
    displayRows,
    groupedRows,
    gridLoading = false,
    currentView,
    sortRules,
    filterRules,
    rowColorRules,
    groupByRules,
    hiddenFieldKeys,
    columnWidths,
    saveViewConfig,
    toggleSort,
    setColumnWidths,
    setFilterRules,
    setHiddenFieldKeys,
    setRowColorRules,
    setGroupByRules,
    updateCell,
    batchUpdateCells,
    addRow,
    batchAddRows,
    deleteRow,
    batchDeleteRows,
    duplicateRow,
    handleUpdateField,
    stageMoveRows,
    cancelMoveRows,
    batchMoveRows,
    setSelectedRow,
    setShowDetailModal,
    setShowNewFieldModal,
    setFieldContextMenu,
  } = tableCtx

  const getRowBgColorClass = (row: any) => {
    if (!rowColorRules || rowColorRules.length === 0) return ''
    for (const rule of rowColorRules) {
      const val = row.data?.[rule.fieldKey]
      if (val !== undefined && String(val) === String(rule.value)) {
        return `row-color-${rule.color}`
      }
    }
    return ''
  }

  return (
    <>
      {/* View selector and header toolbar */}
      <ViewToolbar
        canManageStructure={currentUserRolePermissions.canManageStructure}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        views={views}
        activeViewId={activeViewId}
        setActiveViewId={(id) => {
          onSetActiveTableId(activeTableId || 0)
          if (typeof window !== 'undefined' && activeTableId) {
            localStorage.setItem(`activeViewId_${activeTableId}`, String(id))
          }
        }}
        applyViewConfig={applyViewConfig}
        setShowNewViewModal={setShowNewViewModal}
        saveViewConfig={saveViewConfig}
        onDuplicateView={handleDuplicateView}
        onDeleteView={handleDeleteViewById}
        onRenameView={handleRenameViewById}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortField={sortField}
        setSortField={setSortField}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        sortRules={sortRules}
        setSortRules={(rules: SortRule[]) => {
          const primaryKey = rules.length > 0 ? rules[0].fieldKey : null
          const primaryOrder = rules.length > 0 ? rules[0].order : 'asc'
          setSortField(primaryKey)
          setSortOrder(primaryOrder)
          if (activeViewId) {
            saveViewConfig(activeViewId, {
              sortField: primaryKey,
              sortOrder: primaryOrder,
              sortRules: rules,
            })
          }
        }}
        filterRules={filterRules}
        setFilterRules={(rules: FilterRule[]) => {
          setFilterRules(rules)
          if (activeViewId) {
            saveViewConfig(activeViewId, {
              filters: JSON.stringify({ filterType, rules }),
              filterType,
            })
          }
        }}
        filterType={filterType}
        setFilterType={(type: 'AND' | 'OR') => {
          setFilterType(type)
          if (activeViewId) {
            saveViewConfig(activeViewId, {
              filters: JSON.stringify({ filterType: type, rules: filterRules }),
              filterType: type,
            })
          }
        }}
        rowColorRules={Array.isArray(rowColorRules) ? rowColorRules : []}
        setRowColorRules={(rules: RowColorRule[]) => {
          setRowColorRules(rules)
          if (activeViewId) {
            saveViewConfig(activeViewId, { rowColors: JSON.stringify(rules) })
          }
        }}
        groupByField={groupByField}
        setGroupByField={setGroupByField}
        groupByRules={groupByRules}
        setGroupByRules={(rules: GroupByRule[]) => {
          setGroupByRules(rules)
          const primaryKey = rules.length > 0 ? rules[0].fieldKey : null
          setGroupByField(primaryKey)
          setGroupCollapseState({ mode: 'expand', exceptions: {} })
          if (activeViewId) {
            saveViewConfig(activeViewId, {
              groupByField: rules.length > 0 ? JSON.stringify(rules) : null,
              groupByRules: rules,
            })
          }
        }}
        onToggleCollapseAllGroups={(collapse) => {
          setGroupCollapseState({
            mode: collapse ? 'collapse' : 'expand',
            exceptions: {},
          })
        }}
        fields={fields}
        hiddenFieldKeys={hiddenFieldKeys}
        setHiddenFieldKeys={setHiddenFieldKeys}
        rowHeightSize={rowHeightSize}
        setRowHeightSize={setRowHeightSize}
        handleExportCSV={handleExportCSV}
        handleCSVImport={handleCSVImport}
        csvInputRef={csvInputRef}
        onImportAirtable={() => setShowAirtableModal(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => undo(activeTableId)}
        onRedo={() => redo(activeTableId)}
      />

      {/* View content with PullToRefresh */}
      <PullToRefresh
        onRefresh={async () => {
          if (typeof window !== 'undefined') {
            addToast('正在重新載入全網頁與最新版本...', 'info')
            window.location.reload()
          }
        }}
      >
        <div
          className="layout__col-2-2 content"
          style={{
            '--row-height':
              rowHeightSize === 'medium'
                ? '44px'
                : rowHeightSize === 'large'
                ? '60px'
                : rowHeightSize === 'extra'
                ? '80px'
                : '32px',
          } as any}
        >
          <DatabaseViewRouter
            currentView={currentView}
            fields={fields}
            hiddenFieldKeys={hiddenFieldKeys}
            displayRows={displayRows}
            gridLoading={gridLoading}
            readOnly={!currentUser || !currentUserRolePermissions.canEditData}
            isOffline={isOffline}
            frozenColumnsCount={frozenColumnsCount}
            columnWidths={columnWidths}
            sortField={sortField}
            sortOrder={sortOrder}
            sortRules={sortRules}
            groupByField={groupByField}
            groupByRules={groupByRules}
            groupCollapseState={groupCollapseState}
            onUpdateGroupCollapseState={setGroupCollapseState}
            rowColorRules={rowColorRules}
            editingFieldId={editingFieldId}
            editingFieldName={editingFieldName}
            editingCell={editingCell}
            editInputRef={editInputRef}
            searchQuery={searchQuery}
            filterRules={filterRules}
            groupedRows={groupedRows}
            getRowBgColorClass={getRowBgColorClass}
            updateCell={updateCell}
            batchUpdateCells={batchUpdateCells}
            toggleSort={toggleSort}
            setEditingFieldId={setEditingFieldId}
            setEditingFieldName={setEditingFieldName}
            handleColumnDragStart={handleColumnDragStart}
            handleColumnDragOver={handleColumnDragOver}
            handleColumnDrop={handleColumnDrop}
            setColumnWidths={setColumnWidths}
            activeTableId={activeTableId}
            activeViewId={activeViewId}
            newFieldScrollTrigger={newFieldScrollTrigger}
            views={views}
            updateViewConfig={saveViewConfig}
            setContextMenu={setContextMenu}
            setSelectedRow={setSelectedRow}
            setShowDetailModal={setShowDetailModal}
            duplicateRow={duplicateRow || (async () => {})}
            deleteRow={deleteRow || (() => {})}
            batchDeleteRows={batchDeleteRows}
            addRow={addRow}
            batchAddRows={batchAddRows}
            setShowNewFieldModal={setShowNewFieldModal}
            onAddFieldPopover={(pos) => {
              setNewFieldPopoverPos(pos)
              setShowNewFieldModal(true)
            }}
            handleUpdateField={handleUpdateField}
            setFieldContextMenu={setFieldContextMenu}
            onUndo={undo}
            onRedo={redo}
            onReorderRows={handleReorderRows}
            batchMoveRows={batchMoveRows}
            stageMoveRows={stageMoveRows}
            cancelMoveRows={cancelMoveRows}
          />
        </div>
      </PullToRefresh>
    </>
  )
}

export default TableWorkspaceView
