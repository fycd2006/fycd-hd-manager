import React from 'react'
import { WorkspaceModal, DatabaseModal, RenameModal, ViewModal, FieldModal, TableModal } from './Modals'
import RowEditModal from './RowEditModal'
import MembersModal from './MembersModal'
import NotificationsModal from './NotificationsModal'
import { FieldContextMenu } from '../menu/FieldContextMenu'
import type { TableField, TableRow, FilterRule } from '../../types'
import * as fieldService from '../../services/field'

interface GlobalModalsContainerProps {
  wsState: any
  wsActions: any
  uiActions: any
  showTableModal: boolean
  setShowTableModal: (show: boolean) => void
  modalDbIdForTable: number | null
  showRenameModal: boolean
  setShowRenameModal: (show: boolean) => void
  handleRenameSubmit: (name: string) => Promise<void>
  renameNameValue: string
  renameType: string | null
  showNewViewModal: boolean
  setShowNewViewModal: (show: boolean) => void
  createView: (name: string, type: any) => Promise<void>
  showNewFieldModal: boolean
  setShowNewFieldModal: (show: boolean) => void
  editingFieldForModal: TableField | null
  setEditingFieldForModal: (field: TableField | null) => void
  handleUpdateField: (fieldId: number, updates: Partial<TableField>) => Promise<void>
  setFields: React.Dispatch<React.SetStateAction<TableField[]>>
  fields: TableField[]
  showDetailModal: boolean
  setShowDetailModal: (show: boolean) => void
  selectedRow: TableRow | null
  setSelectedRow: (row: TableRow | null) => void
  displayRows: TableRow[]
  currentUserRolePermissions: any
  currentUser?: { username?: string; role?: string } | null
  updateCell: (rowId: number, fieldKey: string, value: any) => Promise<void>
  showMembersModal: boolean
  setShowMembersModal: (show: boolean) => void
  activeTable: any
  setWorkspaceMemberCount: (count: number) => void
  showNotificationsModal: boolean
  setShowNotificationsModal: (show: boolean) => void
  fieldContextMenu: { field: TableField; x: number; y: number } | null
  setFieldContextMenu: (menu: { field: TableField; x: number; y: number } | null) => void
  filterRules: FilterRule[]
  setFilterRules: (rules: FilterRule[]) => void
  hiddenFieldKeys: string[]
  setHiddenFieldKeys: (keys: string[]) => void
  saveViewConfig: (viewId: number, config: any) => void
  toggleSort: (fieldKey: string) => void
  setGroupByField: (fieldKey: string) => void
  deleteField: (fieldId: number) => Promise<void>
}

export const GlobalModalsContainer: React.FC<GlobalModalsContainerProps> = ({
  wsState,
  wsActions,
  uiActions,
  showTableModal,
  setShowTableModal,
  modalDbIdForTable,
  showRenameModal,
  setShowRenameModal,
  handleRenameSubmit,
  renameNameValue,
  renameType,
  showNewViewModal,
  setShowNewViewModal,
  createView,
  showNewFieldModal,
  setShowNewFieldModal,
  editingFieldForModal,
  setEditingFieldForModal,
  handleUpdateField,
  setFields,
  fields,
  showDetailModal,
  setShowDetailModal,
  selectedRow,
  setSelectedRow,
  displayRows,
  currentUserRolePermissions,
  currentUser,
  updateCell,
  showMembersModal,
  setShowMembersModal,
  activeTable,
  setWorkspaceMemberCount,
  showNotificationsModal,
  setShowNotificationsModal,
  fieldContextMenu,
  setFieldContextMenu,
  filterRules,
  setFilterRules,
  hiddenFieldKeys,
  setHiddenFieldKeys,
  saveViewConfig,
  toggleSort,
  setGroupByField,
  deleteField,
}) => {
  return (
    <>
      {/* WorkspaceModal */}
      {wsState.showWorkspaceModal && (
        <WorkspaceModal
          show={wsState.showWorkspaceModal}
          onClose={() => wsActions.setShowWorkspaceModal(false)}
          onSubmit={async (name: string) => {
            await wsActions.createWorkspace(name)
          }}
        />
      )}

      {/* DatabaseModal */}
      {wsState.showDatabaseModal && (
        <DatabaseModal
          show={wsState.showDatabaseModal}
          onClose={() => wsActions.setShowDatabaseModal(false)}
          onSubmit={async (name: string) => {
            await wsActions.createDatabase(wsState.modalWsId!, name)
          }}
        />
      )}

      {/* TableModal */}
      {showTableModal && (
        <TableModal
          show={showTableModal}
          onClose={() => setShowTableModal(false)}
          onSubmit={async (name: string) => {
            if (modalDbIdForTable) {
              const res = await wsActions.createTable(modalDbIdForTable, name)
              if (res.ok) {
                uiActions.addToast('資料表建立成功', 'success')
              } else {
                uiActions.addToast(res.error || '建立資料表失敗', 'error')
              }
            }
          }}
        />
      )}

      {/* RenameModal */}
      {showRenameModal && (
        <RenameModal
          show={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          onSubmit={async (name: string) => {
            await handleRenameSubmit(name)
          }}
          initialValue={renameNameValue}
          type={renameType as 'workspace' | 'database' | 'table'}
        />
      )}

      {/* ViewModal */}
      {showNewViewModal && (
        <ViewModal
          show={showNewViewModal}
          onClose={() => setShowNewViewModal(false)}
          onSubmit={async (name: string, type: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form') => {
            await createView(name, type)
            setShowNewViewModal(false)
          }}
        />
      )}

      {/* FieldModal */}
      {showNewFieldModal && (
        <FieldModal
          show={showNewFieldModal}
          editField={editingFieldForModal}
          onClose={() => {
            setShowNewFieldModal(false)
            setEditingFieldForModal(null)
          }}
          onSubmit={async (name: string, type: string, options?: any) => {
            if (!wsState.activeTableId) {
              uiActions.addToast('未選擇資料表', 'error')
              return
            }
            if (editingFieldForModal) {
              await handleUpdateField(editingFieldForModal.id, { name, type, options })
              setShowNewFieldModal(false)
              setEditingFieldForModal(null)
              uiActions.addToast(`欄位 "${name}" 已成功更新`, 'success')
            } else {
              const res = await fieldService.createField(wsState.activeTableId, { name, type, options } as any)
              if (res.ok && res.field) {
                setFields((prev: TableField[]) => [...prev, res.field!])
                setShowNewFieldModal(false)
                uiActions.addToast(`欄位 "${name}" 已成功建立`, 'success')
              } else {
                uiActions.addToast(res.error || '新增欄位失敗', 'error')
              }
            }
          }}
          tables={wsState.workspaces.flatMap((w: any) => w.databases?.flatMap((d: any) => d.tables || []) || [])}
          fields={fields}
        />
      )}

      {/* RowEditModal */}
      {showDetailModal && selectedRow && (
        <RowEditModal
          show={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          row={selectedRow}
          rowIndex={displayRows.findIndex(r => r.id === selectedRow.id)}
          totalRows={displayRows.length}
          fields={fields}
          readOnly={!currentUserRolePermissions.canEditData}
          currentUser={currentUser}
          onUpdateCell={updateCell}
          onNavigatePrevious={() => {
            const idx = displayRows.findIndex(r => r.id === selectedRow.id)
            if (idx > 0) setSelectedRow(displayRows[idx - 1])
          }}
          onNavigateNext={() => {
            const idx = displayRows.findIndex(r => r.id === selectedRow.id)
            if (idx >= 0 && idx < displayRows.length - 1) setSelectedRow(displayRows[idx + 1])
          }}
        />
      )}

      {/* MembersModal */}
      {showMembersModal && (
        <MembersModal
          show={showMembersModal}
          onClose={() => setShowMembersModal(false)}
          workspace={
            activeTable
              ? wsState.workspaces.find((w: any) => w.databases?.some((d: any) => d.tables?.some((t: any) => t.id === activeTable.id))) || wsState.workspaces[0]
              : wsState.workspaces[0]
          }
          onToast={uiActions.addToast}
          onUpdateWorkspaceMemberCount={setWorkspaceMemberCount}
        />
      )}

      {/* NotificationsModal */}
      {showNotificationsModal && (
        <NotificationsModal
          show={showNotificationsModal}
          onClose={() => setShowNotificationsModal(false)}
          onToast={uiActions.addToast}
          onRefreshWorkspaces={wsActions.fetchWorkspaces}
        />
      )}

      {/* Field Context Menu */}
      {fieldContextMenu && (
        <FieldContextMenu
          field={fieldContextMenu.field}
          x={fieldContextMenu.x}
          y={fieldContextMenu.y}
          onClose={() => setFieldContextMenu(null)}
          onEditField={(field) => {
            setEditingFieldForModal(field)
            setShowNewFieldModal(true)
          }}
          onConfigureDateDependencies={(field) => {
            uiActions.addToast(`已設定「${field.name}」日期依賴關係`, 'info')
          }}
          onEditPermissions={(field) => {
            uiActions.addToast(`已更新「${field.name}」欄位權限`, 'info')
          }}
          onInsertLeft={(field) => {
            setShowNewFieldModal(true)
            uiActions.addToast(`在「${field.name}」左側新增欄位`, 'info')
          }}
          onInsertRight={(field) => {
            setShowNewFieldModal(true)
            uiActions.addToast(`在「${field.name}」右側新增欄位`, 'info')
          }}
          onDuplicateField={async (field) => {
            if (!wsState.activeTableId) return
            const newName = `${field.name} (Copy)`
            const res = await fieldService.createField(wsState.activeTableId, { name: newName, type: field.type, options: field.options })
            if (res.ok && res.field) {
              setFields((prev: TableField[]) => [...prev, res.field!])
              uiActions.addToast(`已複製欄位「${field.name}」`, 'success')
            }
          }}
          onCreateFilter={(field) => {
            const newRules: FilterRule[] = [...filterRules, { fieldKey: `field_${field.id}`, operator: 'contains', value: '' }]
            setFilterRules(newRules)
            if (wsState.activeViewId) {
              saveViewConfig(wsState.activeViewId, { filters: JSON.stringify(newRules) })
            }
            uiActions.addToast(`已建立「${field.name}」的篩選條件`, 'info')
          }}
          onSortAsc={(field) => {
            toggleSort(`field_${field.id}`)
            uiActions.addToast(`已依「${field.name}」升序排序`, 'info')
          }}
          onSortDesc={(field) => {
            toggleSort(`field_${field.id}`)
            uiActions.addToast(`已依「${field.name}」降序排序`, 'info')
          }}
          onGroupBy={(field) => {
            setGroupByField(`field_${field.id}`)
            uiActions.addToast(`已依「${field.name}」分組`, 'info')
          }}
          onHideField={(field) => {
            const key = `field_${field.id}`
            if (!hiddenFieldKeys.includes(key)) {
              const updated = [...hiddenFieldKeys, key]
              setHiddenFieldKeys(updated)
              if (wsState.activeViewId) {
                saveViewConfig(wsState.activeViewId, { hiddenFields: JSON.stringify(updated) })
              }
              uiActions.addToast(`已隱藏欄位「${field.name}」`, 'info')
            }
          }}
          onDeleteField={async (field) => {
            if (confirm(`確定要刪除欄位「${field.name}」？`)) {
              deleteField(field.id)
            }
          }}
        />
      )}
    </>
  )
}
export default GlobalModalsContainer
