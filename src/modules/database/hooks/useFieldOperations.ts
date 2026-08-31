'use client'

import { useState, useCallback } from 'react'
import * as fieldService from '@/modules/database/services/field'
import type { TableField } from '@/modules/database/types'

interface UseFieldOperationsParams {
  activeTableId: number | null
  setFields: React.Dispatch<React.SetStateAction<TableField[]>>
  fetchTableData: (tableId: number) => Promise<void>
  fetchWorkspaces: () => Promise<unknown>
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  onFieldCreated?: () => void
}

export function useFieldOperations({
  activeTableId,
  setFields,
  fetchTableData,
  fetchWorkspaces,
  addToast,
  onFieldCreated,
}: UseFieldOperationsParams) {
  // Field modal state
  const [showNewFieldModal, setShowNewFieldModal] = useState(false)
  const [newFieldPopoverPos, setNewFieldPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState('text')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [newFieldTargetTableId, setNewFieldTargetTableId] = useState<number | null>(null)

  // Lookup / Rollup options
  const [newFieldRelationFieldId, setNewFieldRelationFieldId] = useState<number | null>(null)
  const [newFieldTargetFieldId, setNewFieldTargetFieldId] = useState<number | null>(null)
  const [newFieldRollupFunction, setNewFieldRollupFunction] = useState('sum')
  const [targetTableFields, setTargetTableFields] = useState<TableField[]>([])

  // Editing state
  const [editingFieldForModal, setEditingFieldForModal] = useState<TableField | null>(null)

  const createField = useCallback(async () => {
    if (!newFieldName.trim() || !activeTableId) return
    try {
      let parsedOptions: unknown = null
      if ((newFieldType === 'single_select' || newFieldType === 'multiple_select') && newFieldOptions.trim()) {
        parsedOptions = { choices: newFieldOptions.split(',').map(c => c.trim()).filter(Boolean) }
      } else if (newFieldType === 'link_row' && newFieldTargetTableId) {
        parsedOptions = { targetTableId: newFieldTargetTableId }
      } else if ((newFieldType === 'lookup' || newFieldType === 'rollup') && newFieldRelationFieldId && newFieldTargetFieldId) {
        parsedOptions = {
          relationFieldId: newFieldRelationFieldId,
          targetFieldId: newFieldTargetFieldId,
          ...(newFieldType === 'rollup' && { rollupFunction: newFieldRollupFunction })
        }
      } else if (newFieldType === 'formula') {
        parsedOptions = newFieldOptions.trim()
      }

      const serializedOptions = parsedOptions !== null && parsedOptions !== undefined
        ? (typeof parsedOptions === 'string' ? parsedOptions : JSON.stringify(parsedOptions))
        : null

      await fieldService.createField(activeTableId, { name: newFieldName.trim(), type: newFieldType, options: serializedOptions })
      setShowNewFieldModal(false)
      setNewFieldName('')
      setNewFieldType('text')
      setNewFieldOptions('')
      await fetchTableData(activeTableId)
      await fetchWorkspaces()
      onFieldCreated?.()
      addToast(`欄位「${newFieldName}」已新增`, 'success')
    } catch {
      addToast('新增欄位失敗', 'error')
    }
  }, [newFieldName, newFieldType, newFieldOptions, newFieldTargetTableId, newFieldRelationFieldId, newFieldTargetFieldId, newFieldRollupFunction, activeTableId, fetchTableData, fetchWorkspaces, addToast, onFieldCreated])

  const deleteField = useCallback(async (fieldId: number) => {
    if (!activeTableId) return
    try {
      await fieldService.deleteField(activeTableId, fieldId)
      await fetchTableData(activeTableId)
      await fetchWorkspaces()
      addToast('欄位已刪除', 'success')
    } catch {
      addToast('刪除欄位失敗', 'error')
    }
  }, [activeTableId, fetchTableData, fetchWorkspaces, addToast])

  const renameField = useCallback(async (fieldId: number, editingFieldName: string) => {
    if (!editingFieldName.trim() || !activeTableId) return
    try {
      await fieldService.renameField(activeTableId, fieldId, editingFieldName.trim())
      await fetchTableData(activeTableId)
      addToast('欄位名稱已更新', 'success')
    } catch {
      addToast('更新欄位名稱失敗', 'error')
    }
  }, [activeTableId, fetchTableData, addToast])

  const handleUpdateField = useCallback(async (fieldId: number, updates: Partial<TableField>) => {
    if (!activeTableId) return

    const formattedOptions = updates.options !== undefined
      ? (typeof updates.options === 'string' ? updates.options : JSON.stringify(updates.options))
      : undefined

    // Optimistically update local fields state immediately
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          ...updates,
          ...(formattedOptions !== undefined && { options: formattedOptions })
        }
      }
      return f
    }))

    const res = await fieldService.updateField(activeTableId, fieldId, updates)
    if (!res.ok) {
      addToast(res.error || '更新欄位失敗', 'error')
    }
  }, [activeTableId, setFields, addToast])

  return {
    // State
    showNewFieldModal, setShowNewFieldModal,
    newFieldPopoverPos, setNewFieldPopoverPos,
    newFieldName, setNewFieldName,
    newFieldType, setNewFieldType,
    newFieldOptions, setNewFieldOptions,
    newFieldTargetTableId, setNewFieldTargetTableId,
    newFieldRelationFieldId, setNewFieldRelationFieldId,
    newFieldTargetFieldId, setNewFieldTargetFieldId,
    newFieldRollupFunction, setNewFieldRollupFunction,
    targetTableFields, setTargetTableFields,
    editingFieldForModal, setEditingFieldForModal,
    // Functions
    createField,
    deleteField,
    renameField,
    handleUpdateField,
  }
}
