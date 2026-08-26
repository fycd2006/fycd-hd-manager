import { useCallback } from 'react'
import type { TableField, TableRow, CellValue, GroupByRule, SortRule, SortOrder, TableView } from '../types'
import * as rowService from '../services/row'

export interface UseRowOperationsOptions {
  activeTableId: number | null
  activeViewId?: number | null
  fields: TableField[]
  rows: TableRow[]
  setRows: (payload: TableRow[] | ((prev: TableRow[]) => TableRow[])) => void
  displayRows: TableRow[]
  groupByRules?: GroupByRule[]
  groupByField?: string | null
  sortField?: string | null
  sortRules?: SortRule[]
  setSortField: (field: string | null) => void
  setSortRules: (rules: SortRule[]) => void
  setSortOrder: (order: SortOrder) => void
  saveViewConfig?: (viewId: number, config: Partial<TableView>) => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  setEditingCell?: (cell: { rowId: number; fieldKey: string } | null) => void
  setEditingCellValue?: (value: string) => void
}

export function useRowOperations({
  activeTableId,
  activeViewId,
  fields,
  rows,
  setRows,
  displayRows,
  groupByRules,
  groupByField,
  sortField,
  sortRules,
  setSortField,
  setSortRules,
  setSortOrder,
  saveViewConfig,
  addToast,
  setEditingCell,
  setEditingCellValue,
}: UseRowOperationsOptions) {
  // Add single row
  const addRow = useCallback(async (overrides?: Record<string, CellValue>, autoInherit = false) => {
    if (!activeTableId) return
    try {
      let baseData: Record<string, CellValue> = {}
      if (autoInherit && rows.length > 0) {
        const lastRow = rows[rows.length - 1]
        baseData = { ...lastRow.data }

        fields.forEach(f => {
          const key = `field_${f.id}`
          if (['created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'lookup', 'rollup', 'formula'].includes(f.type)) {
            delete baseData[key]
          }
        })
      } else {
        fields.forEach(f => {
          const key = `field_${f.id}`
          switch (f.type) {
            case 'boolean': baseData[key] = false; break
            case 'number': baseData[key] = null; break
            case 'link_row': baseData[key] = []; break
            case 'multiple_select': baseData[key] = []; break
            default: baseData[key] = ''
          }
        })
      }

      if (overrides) {
        Object.assign(baseData, overrides)
      }

      const result = await rowService.createRow(activeTableId, baseData)
      if (result.ok && result.row) {
        setRows(prev => [...prev, result.row!])

        fetch(`/api/tables/${activeTableId}/rows/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rowId: result.row!.id,
            content: '[HISTORY] 建立了此資料列'
          })
        }).catch(() => { })

        if (fields.length > 0 && setEditingCell && setEditingCellValue) {
          const firstKey = `field_${fields[0].id}`
          setEditingCell({ rowId: result.row!.id, fieldKey: firstKey })
          setEditingCellValue('')
        }
      }
    } catch {
      addToast('新增列失敗', 'error')
    }
  }, [activeTableId, fields, rows, setRows, addToast, setEditingCell, setEditingCellValue])

  // Batch add multiple rows
  const batchAddRows = useCallback(async (rowsToCreate: Array<Record<string, CellValue>>) => {
    if (!activeTableId || rowsToCreate.length === 0) return
    try {
      const payloadRows = rowsToCreate.map(rowData => {
        const baseData: Record<string, CellValue> = {}
        fields.forEach(f => {
          const key = `field_${f.id}`
          switch (f.type) {
            case 'boolean': baseData[key] = false; break
            case 'number': baseData[key] = null; break
            case 'link_row': baseData[key] = []; break
            case 'multiple_select': baseData[key] = []; break
            default: baseData[key] = ''
          }
        })
        Object.assign(baseData, rowData)
        return baseData
      })

      const results = await Promise.all(
        payloadRows.map(baseData => rowService.createRow(activeTableId, baseData))
      )
      const createdRows = results.filter(r => r.ok && r.row).map(r => r.row!)

      if (createdRows.length > 0) {
        setRows(prev => [...prev, ...createdRows])
        addToast(`成功新增 ${createdRows.length} 列資料`, 'success')
      }
    } catch {
      addToast('批次新增列失敗', 'error')
    }
  }, [activeTableId, fields, setRows, addToast])

  // Reorder rows (Drag & Drop with DB persistence & Cross-Group field sync)
  const handleReorderRows = useCallback(async (srcIdx: number, targetIdx: number) => {
    if (!activeTableId || srcIdx === targetIdx) return
    const sourceRow = displayRows[srcIdx]
    const targetRow = displayRows[targetIdx]
    if (!sourceRow || !targetRow) return

    // Check if dragging across groups
    const effectiveGroups = groupByRules && groupByRules.length > 0
      ? groupByRules
      : (groupByField ? [{ fieldKey: groupByField, order: 'asc' as const }] : [])

    let fieldUpdates: Record<string, CellValue> | null = null
    if (effectiveGroups.length > 0) {
      effectiveGroups.forEach(grp => {
        const targetVal = targetRow.data?.[grp.fieldKey] ?? targetRow.data?.[grp.fieldKey.replace('field_', '')]
        const srcVal = sourceRow.data?.[grp.fieldKey] ?? sourceRow.data?.[grp.fieldKey.replace('field_', '')]
        if (targetVal !== undefined && targetVal !== srcVal) {
          if (!fieldUpdates) fieldUpdates = {}
          fieldUpdates[grp.fieldKey] = targetVal
        }
      })
    }

    // Reorder within displayRows (which respects current sort/group rendering)
    const newDisplayOrder = [...displayRows]
    let [moved] = newDisplayOrder.splice(srcIdx, 1)
    if (fieldUpdates) {
      const updates: Record<string, CellValue> = fieldUpdates
      const currentData: Record<string, CellValue> = typeof moved.data === 'object' && moved.data !== null ? moved.data : {}
      moved = { ...moved, data: Object.assign({}, currentData, updates) }
    }
    newDisplayOrder.splice(targetIdx, 0, moved)

    // Build new full rows array
    const displayRowIds = new Set(displayRows.map(r => r.id))
    const nonDisplayRows = rows.filter(r => !displayRowIds.has(r.id))
    const reorderedDisplayRows = newDisplayOrder.map((r, idx) => ({ ...r, order: idx }))
    const nonDisplayWithOrder = nonDisplayRows.map((r, idx) => ({ ...r, order: reorderedDisplayRows.length + idx }))
    const updatedRows = [...reorderedDisplayRows, ...nonDisplayWithOrder]

    setRows(updatedRows)

    const rowIds = newDisplayOrder.map(r => r.id)

    // Clear sort so server order is respected after reload
    if (sortField || (sortRules && sortRules.length > 0)) {
      setSortField(null)
      setSortRules([])
      setSortOrder('asc')
      if (activeViewId && saveViewConfig) {
        await saveViewConfig(activeViewId, { sortField: null, sortOrder: 'asc' })
      }
    }

    try {
      if (fieldUpdates) {
        await rowService.updateRow(activeTableId, sourceRow.id, fieldUpdates)
      }
      const res = await rowService.reorderRows(activeTableId, rowIds)
      if (res.ok) {
        addToast('已儲存資料列順序', 'success')
      } else {
        addToast(res.error || '儲存資料列順序失敗', 'error')
        setRows(rows)
      }
    } catch {
      addToast('儲存資料列順序失敗', 'error')
      setRows(rows)
    }
  }, [
    activeTableId,
    activeViewId,
    displayRows,
    groupByRules,
    groupByField,
    rows,
    setRows,
    sortField,
    sortRules,
    setSortField,
    setSortRules,
    setSortOrder,
    saveViewConfig,
    addToast
  ])

  // Delete row
  const deleteRow = useCallback(async (rowId: number) => {
    if (!activeTableId) return
    try {
      const result = await rowService.deleteRow(activeTableId, rowId)
      if (result.ok) {
        setRows(prev => prev.filter(r => r.id !== rowId))
        addToast('資料列已刪除', 'success')
      }
    } catch {
      addToast('刪除列失敗', 'error')
    }
  }, [activeTableId, setRows, addToast])

  // Duplicate row
  const duplicateRow = useCallback(async (rowToCopy: TableRow) => {
    if (!activeTableId) return
    try {
      const copiedData = { ...rowToCopy.data }
      fields.forEach(f => {
        const key = `field_${f.id}`
        if (['created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'lookup', 'rollup', 'formula'].includes(f.type)) {
          delete copiedData[key]
        }
      })

      const result = await rowService.createRow(activeTableId, copiedData)
      if (result.ok && result.row) {
        setRows(prev => [...prev, result.row!])
        addToast('已複製該列資料並新增為新列', 'success')
      }
    } catch {
      addToast('複製列資料失敗', 'error')
    }
  }, [activeTableId, fields, setRows, addToast])

  return {
    addRow,
    batchAddRows,
    handleReorderRows,
    deleteRow,
    duplicateRow,
  }
}
