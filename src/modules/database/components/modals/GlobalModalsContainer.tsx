import React, { useState } from 'react'
import { WorkspaceModal, DatabaseModal, RenameModal, ViewModal, TableModal } from './Modals'
import { CreateFieldPopover } from '../field/CreateFieldPopover'
import RowEditModal from './RowEditModal'
import MembersModal from './MembersModal'
import NotificationsModal from './NotificationsModal'
import { FieldContextMenu } from '../menu/FieldContextMenu'
import type { TableField, TableRow, FilterRule } from '../../types'
import type { WorkspaceState, WorkspaceActions } from '../../store/useWorkspaceStore'
import * as fieldService from '../../services/field'

interface GlobalModalsContainerProps {
  wsState: WorkspaceState
  wsActions: WorkspaceActions
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
  newFieldPopoverPos?: { top: number; left: number } | null
  setNewFieldPopoverPos?: (pos: { top: number; left: number } | null) => void
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
  saveViewConfig: (viewId: number, updates: any) => Promise<void>
  toggleSort: (fieldKey: string) => void
  setGroupByField: (fieldKey: string | null) => void
  deleteField: (fieldId: number) => Promise<void>
  onRefreshRows?: () => Promise<void>
  onOpenAirtableImport?: () => void
}

export default function GlobalModalsContainer({
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
  newFieldPopoverPos,
  setNewFieldPopoverPos,
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
  onRefreshRows,
  onOpenAirtableImport
}: GlobalModalsContainerProps) {
  const [insertFieldContext, setInsertFieldContext] = useState<{ targetFieldId: number; position: 'left' | 'right' } | null>(null)

  const reloadFields = async () => {
    if (!wsState.activeTableId) return
    const refreshed = await fieldService.fetchFields(wsState.activeTableId)
    setFields(refreshed)
    if (onRefreshRows) await onRefreshRows()
  }

  return (
    <>
      {/* WorkspaceModal */}
      {wsState.showWorkspaceModal && (
        <WorkspaceModal
          show={wsState.showWorkspaceModal}
          onClose={() => wsActions.setShowWorkspaceModal(false)}
          onSubmit={async (name) => {
            const res = await wsActions.createWorkspace(name)
            if (res.ok) {
              uiActions.addToast('工作區建立成功！', 'success')
              wsActions.setShowWorkspaceModal(false)
            } else {
              uiActions.addToast(res.error || '建立失敗', 'error')
            }
          }}
        />
      )}

      {/* DatabaseModal */}
      {wsState.showDatabaseModal && (
        <DatabaseModal
          show={wsState.showDatabaseModal}
          onClose={() => wsActions.setShowDatabaseModal(false)}
          onOpenAirtableImport={onOpenAirtableImport}
          onSubmit={async (name) => {
            const wsId = wsState.modalWsId || wsState.activeWorkspaceId
            if (!wsId) {
              uiActions.addToast('請先選擇一個工作區', 'error')
              return
            }
            const res = await wsActions.createDatabase(wsId, name)
            if (res.ok) {
              uiActions.addToast('資料庫建立成功！', 'success')
              wsActions.setShowDatabaseModal(false)
            } else {
              uiActions.addToast(res.error || '建立失敗', 'error')
            }
          }}
        />
      )}

      {/* TableModal */}
      {showTableModal && (
        <TableModal
          show={showTableModal}
          onClose={() => setShowTableModal(false)}
          onSubmit={async (name) => {
            let targetDbId = modalDbIdForTable || wsState.modalDbId
            if (!targetDbId && wsState.workspaces) {
              for (const ws of wsState.workspaces) {
                for (const db of ws.databases || []) {
                  if (wsState.activeTableId && (db.tables || []).some((t: any) => t.id === wsState.activeTableId)) {
                    targetDbId = db.id
                    break
                  }
                }
                if (targetDbId) break
              }
              if (!targetDbId) {
                const activeWs = wsState.workspaces.find((w: any) => w.id === wsState.activeWorkspaceId) || wsState.workspaces[0]
                targetDbId = activeWs?.databases?.[0]?.id || null
              }
            }
            if (!targetDbId) {
              uiActions.addToast('請先建立或選擇一個資料庫', 'error')
              return
            }
            const res = await wsActions.createTable(targetDbId, name)
            if (res.ok) {
              uiActions.addToast('資料表建立成功！', 'success')
              setShowTableModal(false)
            } else {
              uiActions.addToast(res.error || '建立失敗', 'error')
            }
          }}
        />
      )}

      {/* RenameModal */}
      {showRenameModal && (
        <RenameModal
          show={showRenameModal}
          onClose={() => setShowRenameModal(false)}
          onSubmit={handleRenameSubmit}
          initialValue={renameNameValue}
          type={renameType as any}
        />
      )}

      {/* ViewModal */}
      {showNewViewModal && (
        <ViewModal
          show={showNewViewModal}
          onClose={() => setShowNewViewModal(false)}
          onSubmit={createView}
        />
      )}

      {/* CreateFieldPopover (Anchor-positioned like Baserow CreateFieldContext) */}
      {showNewFieldModal && (
        <CreateFieldPopover
          show={showNewFieldModal}
          position={
            newFieldPopoverPos ||
            (fieldContextMenu ? { top: fieldContextMenu.y, left: fieldContextMenu.x } : { top: 80, left: typeof window !== 'undefined' ? Math.max(16, window.innerWidth / 2 - 190) : 300 })
          }
          onClose={() => {
            setShowNewFieldModal(false)
            setEditingFieldForModal(null)
            setInsertFieldContext(null)
            setNewFieldPopoverPos?.(null)
          }}
          onSubmit={async (name, type, options) => {
            if (!wsState.activeTableId) return
            if (editingFieldForModal) {
              const res = await fieldService.updateField(wsState.activeTableId, editingFieldForModal.id, { name, type, options })
              if (res.ok) {
                await reloadFields()
                uiActions.addToast('更新欄位成功', 'success')
              } else {
                uiActions.addToast('更新欄位失敗', 'error')
              }
            } else {
              const payload: any = { name, type, options }
              if (insertFieldContext) {
                payload.targetFieldId = insertFieldContext.targetFieldId
                payload.position = insertFieldContext.position
              }
              const res = await fieldService.createField(wsState.activeTableId, payload)
              if (res.ok && res.field) {
                await reloadFields()
                uiActions.addToast('新增欄位成功', 'success')
              } else {
                uiActions.addToast('新增欄位失敗', 'error')
              }
            }
            setShowNewFieldModal(false)
            setEditingFieldForModal(null)
            setInsertFieldContext(null)
            setNewFieldPopoverPos?.(null)
          }}
          tables={wsState.workspaces.flatMap((w: any) => w.databases?.flatMap((d: any) => d.tables || []) || [])}
          fields={fields}
          editField={editingFieldForModal}
        />
      )}

      {/* RowEditModal (Detail View Modal) */}
      {showDetailModal && selectedRow && (
        <RowEditModal
          show={showDetailModal}
          row={selectedRow}
          rowIndex={displayRows.findIndex((r) => r.id === selectedRow.id)}
          totalRows={displayRows.length}
          fields={fields}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedRow(null)
          }}
          onUpdateCell={updateCell}
          onUpdateField={handleUpdateField}
          onNavigatePrevious={() => {
            const idx = displayRows.findIndex((r) => r.id === selectedRow.id)
            if (idx > 0) setSelectedRow(displayRows[idx - 1])
          }}
          onNavigateNext={() => {
            const idx = displayRows.findIndex((r) => r.id === selectedRow.id)
            if (idx !== -1 && idx < displayRows.length - 1) setSelectedRow(displayRows[idx + 1])
          }}
          currentUser={currentUser}
          readOnly={currentUserRolePermissions ? !(currentUserRolePermissions.canEditData ?? currentUserRolePermissions.canEditRows ?? true) : false}
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
          onChangePrimaryField={async (field) => {
            if (!wsState.activeTableId) return
            const targetFieldId = field.id
            const currentIndex = fields.findIndex(f => f.id === targetFieldId)
            if (currentIndex === -1 || currentIndex === 0) {
              uiActions.addToast(`欄位「${field.name}」已經是主要欄位`, 'info')
              return
            }

            const reorderedFields = [...fields]
            const [targetField] = reorderedFields.splice(currentIndex, 1)
            reorderedFields.splice(0, 0, targetField)

            const fieldOrders = reorderedFields.map(f => f.id)
            setFields(reorderedFields.map((f, index) => ({ ...f, order: index })))

            try {
              await fieldService.reorderFields(wsState.activeTableId, fieldOrders)
              uiActions.addToast(`已成功將「${field.name}」設定為主要欄位`, 'success')
            } catch {
              uiActions.addToast('變更主要欄位失敗', 'error')
            }
          }}
          onConfigureDateDependencies={(field) => {
            uiActions.addToast(`已設定「${field.name}」日期依賴關係`, 'info')
          }}
          onEditPermissions={(field) => {
            uiActions.addToast(`已更新「${field.name}」欄位權限`, 'info')
          }}
          onInsertLeft={(field) => {
            setInsertFieldContext({ targetFieldId: field.id, position: 'left' })
            setShowNewFieldModal(true)
            uiActions.addToast(`在「${field.name}」左側新增欄位`, 'info')
          }}
          onInsertRight={(field) => {
            setInsertFieldContext({ targetFieldId: field.id, position: 'right' })
            setShowNewFieldModal(true)
            uiActions.addToast(`在「${field.name}」右側新增欄位`, 'info')
          }}
          onDuplicateField={async (field) => {
            if (!wsState.activeTableId) return
            const res = await fieldService.duplicateField(wsState.activeTableId, field.id)
            if (res.ok && res.field) {
              await reloadFields()
              uiActions.addToast(`已複製欄位「${field.name}」與欄位內容`, 'success')
            } else {
              uiActions.addToast('複製欄位失敗', 'error')
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
