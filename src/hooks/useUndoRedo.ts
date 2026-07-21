'use client'

import { useState, useCallback } from 'react'

type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

export interface EditHistoryEntry {
  rowId: number
  fieldKey: string
  before: CellValue
  after: CellValue
}

export function useUndoRedo(onApplyHistory: (rowId: number, fieldKey: string, value: CellValue) => Promise<void>) {
  const [undoStack, setUndoStack] = useState<EditHistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<EditHistoryEntry[]>([])

  const pushEdit = useCallback((entry: EditHistoryEntry) => {
    // Only push if before and after are actually different
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) return

    setUndoStack(prev => [...prev, entry])
    setRedoStack([]) // Clear redo stack on new user actions
  }, [])

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return null

    const last = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    
    // Apply old state
    await onApplyHistory(last.rowId, last.fieldKey, last.before)
    
    // Push to redo stack
    setRedoStack(prev => [...prev, last])
    return last
  }, [undoStack, onApplyHistory])

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return null

    const next = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    
    // Apply new state
    await onApplyHistory(next.rowId, next.fieldKey, next.after)
    
    // Push back to undo stack
    setUndoStack(prev => [...prev, next])
    return next
  }, [redoStack, onApplyHistory])

  return {
    pushEdit,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  }
}
