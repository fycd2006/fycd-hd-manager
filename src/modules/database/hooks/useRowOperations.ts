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
  addToast: (message: string, type: 'success' | 'error' | 'info', options?: { action?: { label: string; onClick: () => void }; duration?: number }) => void
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

      // Ensure overrides is a plain data object, not a React SyntheticEvent from onClick
      if (overrides && typeof overrides === 'object' && !('nativeEvent' in overrides) && !('_reactName' in overrides) && !('target' in overrides)) {
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

  // Reorder rows (Drag & Drop with DB persistence, Batch moving & Cross-Group field sync)
  const handleReorderRows = useCallback(async (srcInput: number | number[], targetIdx: number) => {
    if (!activeTableId) return
    const rawIndices = Array.isArray(srcInput) ? srcInput : [srcInput]
    const validSrcIndices = Array.from(new Set(rawIndices))
      .filter(i => typeof i === 'number' && i >= 0 && i < displayRows.length)
      .sort((a, b) => a - b)

    if (validSrcIndices.length === 0) return
    if (validSrcIndices.length === 1 && validSrcIndices[0] === targetIdx) return

    const targetRow = displayRows[targetIdx]
    if (!targetRow) return

    // Check if dragging across groups
    const effectiveGroups = groupByRules && groupByRules.length > 0
      ? groupByRules
      : (groupByField ? [{ fieldKey: groupByField, order: 'asc' as const }] : [])

    const updatesByRowId = new Map<number, Record<string, CellValue>>()
    if (effectiveGroups.length > 0) {
      validSrcIndices.forEach(idx => {
        const row = displayRows[idx]
        if (!row) return
        let fUpdates: Record<string, CellValue> | null = null
        effectiveGroups.forEach(grp => {
          const targetVal = targetRow.data?.[grp.fieldKey] ?? targetRow.data?.[grp.fieldKey.replace('field_', '')]
          const srcVal = row.data?.[grp.fieldKey] ?? row.data?.[grp.fieldKey.replace('field_', '')]
          if (targetVal !== undefined && targetVal !== srcVal) {
            if (!fUpdates) fUpdates = {}
            fUpdates[grp.fieldKey] = targetVal
          }
        })
        if (fUpdates) {
          updatesByRowId.set(row.id, fUpdates)
        }
      })
    }

    // Extract moved rows in their existing relative order
    const movedRows = validSrcIndices.map(idx => {
      let row = displayRows[idx]
      const fUpdates = updatesByRowId.get(row.id)
      if (fUpdates) {
        const currentData: Record<string, CellValue> = typeof row.data === 'object' && row.data !== null ? row.data : {}
        row = { ...row, data: Object.assign({}, currentData, fUpdates) }
      }
      return row
    })

    // Remove moved rows from displayRows
    const movedIdSet = new Set(movedRows.map(r => r.id))
    const remainingRows = displayRows.filter(r => !movedIdSet.has(r.id))

    // Find insertion index in the remaining rows
    let insertIdx = remainingRows.findIndex(r => r.id === targetRow.id)
    if (insertIdx === -1) {
      insertIdx = Math.min(targetIdx, remainingRows.length)
    }

    const newDisplayOrder = [
      ...remainingRows.slice(0, insertIdx),
      ...movedRows,
      ...remainingRows.slice(insertIdx)
    ]

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
      if (updatesByRowId.size > 0) {
        await Promise.all(
          Array.from(updatesByRowId.entries()).map(([rid, u]) =>
            rowService.updateRow(activeTableId, rid, u)
          )
        )
      }
      const res = await rowService.reorderRows(activeTableId, rowIds)
      if (res.ok) {
        addToast(movedRows.length > 1 ? `已移動 ${movedRows.length} 列資料` : '已儲存資料列順序', 'success')
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

  // Delete row — with undo support
  const deleteRow = useCallback(async (rowId: number) => {
    if (!activeTableId) return
    // Snapshot the row data before deletion for undo
    const deletedRow = rows.find(r => r.id === rowId)
    const snapshotData = deletedRow ? { ...deletedRow.data } : null

    try {
      const result = await rowService.deleteRow(activeTableId, rowId)
      if (result.ok) {
        setRows(prev => prev.filter(r => r.id !== rowId))

        // Show undo toast (10s) with action button
        const tableId = activeTableId
        addToast('資料列已刪除', 'info', {
          duration: 10000,
          action: snapshotData ? {
            label: '復原',
            onClick: async () => {
              try {
                // Strip computed fields before re-creating
                const restoreData = { ...snapshotData }
                fields.forEach(f => {
                  const key = `field_${f.id}`
                  if (['created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'lookup', 'rollup', 'formula'].includes(f.type)) {
                    delete restoreData[key]
                  }
                })
                const res = await rowService.createRow(tableId, restoreData)
                if (res.ok && res.row) {
                  setRows(prev => [...prev, res.row!])
                  addToast('已成功復原刪除的資料列', 'success')
                } else {
                  addToast('復原失敗', 'error')
                }
              } catch {
                addToast('復原失敗', 'error')
              }
            }
          } : undefined
        })
      }
    } catch {
      addToast('刪除列失敗', 'error')
    }
  }, [activeTableId, rows, fields, setRows, addToast])

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
