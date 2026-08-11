'use client'

import { useState, useCallback } from 'react'

export type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

export interface EditCellItem {
  rowId: number
  fieldKey: string
  before: CellValue
  after: CellValue
  rowUpdatedAtSnapshot?: string | number
}

export interface EditHistoryAction {
  tableId: number
  edits: EditCellItem[]
  rowUpdatedAtSnapshots?: Record<number, string | number>
}

export function useUndoRedo(
  onApplySingleHistory: (tableId: number, rowId: number, fieldKey: string, value: CellValue) => Promise<void>,
  onApplyBatchHistory?: (tableId: number, updates: Array<{ rowId: number; data: Record<string, CellValue> }>) => Promise<void>,
  onCheckRowStale?: (tableId: number, rowId: number, snapshot: string | number) => boolean,
  onStaleBlocked?: (message: string) => void
) {
  const [undoStack, setUndoStack] = useState<EditHistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<EditHistoryAction[]>([])

  const pushEdit = useCallback((action: EditHistoryAction) => {
    // Filter out edits where before and after are identical
    const validEdits = action.edits.filter(
      e => JSON.stringify(e.before) !== JSON.stringify(e.after)
    )
    if (validEdits.length === 0) return

    setUndoStack(prev => [...prev, { ...action, edits: validEdits }])
    setRedoStack([]) // Clear redo stack on new user actions
  }, [])

  const undo = useCallback(async (activeTableId?: number | null): Promise<boolean> => {
    if (undoStack.length === 0) return false

    // Filter to last matching table action if tableId supplied, or fallback to top
    const targetIdx = activeTableId
      ? undoStack.findLastIndex(a => a.tableId === activeTableId)
      : undoStack.length - 1

    if (targetIdx === -1) return false

    const action = undoStack[targetIdx]
    const newUndoStack = [...undoStack]
    newUndoStack.splice(targetIdx, 1)

    // Perform stale check if callback provided
    if (onCheckRowStale) {
      for (const e of action.edits) {
        const snap = e.rowUpdatedAtSnapshot || action.rowUpdatedAtSnapshots?.[e.rowId]
        if (snap !== undefined && onCheckRowStale(action.tableId, e.rowId, snap)) {
          // Row is stale! Remove from stack and block undo
          setUndoStack(newUndoStack)
          onStaleBlocked?.('這筆資料已被他人變更，無法復原')
          return false
        }
      }
    }

    setUndoStack(newUndoStack)

    // Apply old state
    if (action.edits.length === 1) {
      const e = action.edits[0]
      await onApplySingleHistory(action.tableId, e.rowId, e.fieldKey, e.before)
    } else if (action.edits.length > 1 && onApplyBatchHistory) {
      const rowMap = new Map<number, Record<string, CellValue>>()
      action.edits.forEach(e => {
        const cur = rowMap.get(e.rowId) || {}
        cur[e.fieldKey] = e.before
        rowMap.set(e.rowId, cur)
      })
      const batchUpdates = Array.from(rowMap.entries()).map(([rowId, data]) => ({ rowId, data }))
      await onApplyBatchHistory(action.tableId, batchUpdates)
    } else {
      for (const e of action.edits) {
        await onApplySingleHistory(action.tableId, e.rowId, e.fieldKey, e.before)
      }
    }

    setRedoStack(prev => [...prev, action])
    return true
  }, [undoStack, onApplySingleHistory, onApplyBatchHistory, onCheckRowStale, onStaleBlocked])

  const redo = useCallback(async (activeTableId?: number | null): Promise<boolean> => {
    if (redoStack.length === 0) return false

    const targetIdx = activeTableId
      ? redoStack.findLastIndex(a => a.tableId === activeTableId)
      : redoStack.length - 1

    if (targetIdx === -1) return false

    const action = redoStack[targetIdx]
    const newRedoStack = [...redoStack]
    newRedoStack.splice(targetIdx, 1)

    // Perform stale check if callback provided
    if (onCheckRowStale) {
      for (const e of action.edits) {
        const snap = e.rowUpdatedAtSnapshot || action.rowUpdatedAtSnapshots?.[e.rowId]
        if (snap !== undefined && onCheckRowStale(action.tableId, e.rowId, snap)) {
          setRedoStack(newRedoStack)
          onStaleBlocked?.('這筆資料已被他人變更，無法重做')
          return false
        }
      }
    }

    setRedoStack(newRedoStack)

    // Apply new state
    if (action.edits.length === 1) {
      const e = action.edits[0]
      await onApplySingleHistory(action.tableId, e.rowId, e.fieldKey, e.after)
    } else if (action.edits.length > 1 && onApplyBatchHistory) {
      const rowMap = new Map<number, Record<string, CellValue>>()
      action.edits.forEach(e => {
        const cur = rowMap.get(e.rowId) || {}
        cur[e.fieldKey] = e.after
        rowMap.set(e.rowId, cur)
      })
      const batchUpdates = Array.from(rowMap.entries()).map(([rowId, data]) => ({ rowId, data }))
      await onApplyBatchHistory(action.tableId, batchUpdates)
    } else {
      for (const e of action.edits) {
        await onApplySingleHistory(action.tableId, e.rowId, e.fieldKey, e.after)
      }
    }

    setUndoStack(prev => [...prev, action])
    return true
  }, [redoStack, onApplySingleHistory, onApplyBatchHistory, onCheckRowStale, onStaleBlocked])

  return {
    pushEdit,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  }
}
