'use client'

import { useRef, useEffect, useCallback } from 'react'
import * as rowService from '@/modules/database/services/row'
import { evaluateFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'
import { normalizeRowData } from '@/modules/database/utils/normalizeRowData'
import type { TableRow, TableField, CellValue } from '@/modules/database/types'

interface UseCellEditParams {
  activeTableId: number | null
  rows: TableRow[]
  setRows: (payload: TableRow[] | ((prev: TableRow[]) => TableRow[])) => void
  fields: TableField[]
  pushEdit: (edit: {
    tableId: number
    edits: Array<{ rowId: number; fieldKey: string; before: CellValue; after: CellValue }>
  }) => void
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

/**
 * Encapsulates single-cell debounced editing, concurrency protection,
 * local formula re-computation, cascade updates, and batch cell updates.
 */
export function useCellEdit({
  activeTableId,
  rows,
  setRows,
  fields,
  pushEdit,
  addToast,
}: UseCellEditParams) {
  const cellAbortMap = useRef<Map<string, AbortController>>(new Map())
  const cellSeqMap = useRef<Map<string, number>>(new Map())
  const cellDebounceMap = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Keep references to latest state to avoid stale closures in debounced callbacks
  const rowsRef = useRef(rows)
  const fieldsRef = useRef(fields)
  const activeTableIdRef = useRef(activeTableId)
  const pushEditRef = useRef(pushEdit)
  const addToastRef = useRef(addToast)

  useEffect(() => {
    rowsRef.current = rows
    fieldsRef.current = fields
    activeTableIdRef.current = activeTableId
    pushEditRef.current = pushEdit
    addToastRef.current = addToast
  })

  // Clean up all pending debounce timers and abort controllers when activeTableId changes or on unmount
  useEffect(() => {
    const debounceMap = cellDebounceMap.current
    const abortMap = cellAbortMap.current
    return () => {
      debounceMap.forEach(timer => clearTimeout(timer))
      debounceMap.clear()
      abortMap.forEach(controller => controller.abort())
      abortMap.clear()
    }
  }, [activeTableId])

  /**
   * Internal single cell updater
   */
  const updateSingleCell = useCallback(async (
    rowId: number,
    fieldKeyOrId: string | number,
    value?: CellValue,
    skipPushHistory: boolean = false
  ) => {
    const currentTableId = activeTableIdRef.current
    const currentRows = rowsRef.current
    const currentFields = fieldsRef.current

    if (!currentTableId) return

    const fieldKey = typeof fieldKeyOrId === 'number'
      ? `field_${fieldKeyOrId}`
      : (String(fieldKeyOrId).startsWith('field_') ? String(fieldKeyOrId) : `field_${fieldKeyOrId}`)

    const fieldId = parseInt(fieldKey.replace('field_', ''))
    const field = currentFields.find(f => f.id === fieldId)

    let payloadValue: CellValue = value ?? null
    if ((field?.type === 'link_row' || field?.type === 'collaborator') && Array.isArray(value)) {
      payloadValue = value.map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const obj = item as Record<string, unknown>
          if (typeof obj.id === 'number' || typeof obj.id === 'string') {
            return obj.id
          }
        }
        return item
      })
    }

    const targetRow = currentRows.find(r => r.id === rowId)
    const targetTableId = targetRow?.tableId || currentTableId
    const oldValue = targetRow?.data[fieldKey] ?? null

    try {
      // Optimistically update UI state immediately and recompute formulas locally
      const safeVal = value ?? null
      const formulaFields = currentFields.filter(f => f.type === 'formula')

      setRows(prev => prev.map(r => {
        if (r.id !== rowId) return r
        const updatedData = { ...r.data, [fieldKey]: safeVal }
        normalizeRowData(updatedData)

        formulaFields.forEach(ff => {
          const destKey = `field_${ff.id}`
          let expr = ff.options
          if (!expr) return
          if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
            try {
              let parsed = JSON.parse(expr)
              if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed) } catch { }
              }
              if (parsed && typeof parsed === 'object' && parsed.formula) expr = parsed.formula
            } catch { }
          }
          try {
            const fieldOrder = currentFields.map(f => f.id)
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const res = evaluateFormula(expr, updatedData as any, fieldOrder)
            updatedData[destKey] = res != null ? String(res) : ''
          } catch {
            updatedData[destKey] = '#VALUE!'
          }
        })

        return { ...r, data: updatedData }
      }))

      const cellKey = `${targetTableId}_${rowId}_${fieldKey}`

      // Clear existing debounce timer if user is rapidly typing on the same cell
      if (cellDebounceMap.current.has(cellKey)) {
        clearTimeout(cellDebounceMap.current.get(cellKey)!)
      }

      // 300ms Debounce + AbortController + 12s Timeout Dual-Layer Protection
      const timer = setTimeout(async () => {
        // Guard: Drop if user switched tables before debounce timer fired
        if (targetTableId !== activeTableIdRef.current) return

        if (cellAbortMap.current.has(cellKey)) {
          cellAbortMap.current.get(cellKey)?.abort()
        }
        const controller = new AbortController()
        cellAbortMap.current.set(cellKey, controller)
        const seqId = (cellSeqMap.current.get(cellKey) || 0) + 1
        cellSeqMap.current.set(cellKey, seqId)

        // 12-second Operation Timeout
        const timeoutId = setTimeout(() => {
          controller.abort()
          addToastRef.current('操作逾時 (12 秒未獲確認)，請檢查網路並重試', 'info')
        }, 12000)

        try {
          const result = await rowService.updateCell(targetTableId, rowId, fieldKey, payloadValue, { signal: controller.signal })
          clearTimeout(timeoutId)

          // Guard: Drop if user switched tables during the in-flight network request
          if (targetTableId !== activeTableIdRef.current) return

          if (cellSeqMap.current.get(cellKey) !== seqId) {
            // Obsolete response from older request -> drop
            return
          }

          if (result.ok) {
            if (result.row) {
              const serverData = typeof result.row.data === 'string'
                ? (safeJsonParse(result.row.data, {}) as Record<string, CellValue>)
                : (result.row.data || {})

              setRows(prev => prev.map(r => {
                if (r.id !== rowId) return r
                const mergedData = { ...r.data }
                if (fieldKey in serverData) {
                  mergedData[fieldKey] = serverData[fieldKey]
                }
                fieldsRef.current.forEach(f => {
                  const key = `field_${f.id}`
                  if (['formula', 'lookup', 'rollup', 'last_modified_on', 'last_modified_by', 'created_on', 'created_by', 'autonumber'].includes(f.type)) {
                    if (key in serverData) {
                      mergedData[key] = serverData[key]
                    }
                  }
                })
                normalizeRowData(mergedData)
                return { ...r, data: mergedData }
              }))
            }

            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const affectedRows = (result.row as any)?.affectedRows
            if (Array.isArray(affectedRows) && affectedRows.length > 0) {
              const affectedMap = new Map<number, Record<string, CellValue>>()
              /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
              affectedRows.forEach((ar: any) => affectedMap.set(ar.id, ar.data || {}))

              setRows(prev => prev.map(r => {
                if (affectedMap.has(r.id)) {
                  const newData = { ...r.data, ...affectedMap.get(r.id) }
                  normalizeRowData(newData)
                  return { ...r, data: newData }
                }
                return r
              }))
            }

            if (!skipPushHistory) {
              pushEditRef.current({
                tableId: targetTableId,
                edits: [{ rowId, fieldKey, before: oldValue, after: payloadValue ?? null }]
              })
            }
          } else {
            setRows(prev => prev.map(r => r.id === rowId ? { ...r, data: { ...r.data, [fieldKey]: oldValue } } : r))
            addToastRef.current('更新儲存格失敗', 'error')
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId)
          if (err instanceof Error && err.name === 'AbortError') return
          addToastRef.current('更新儲存格時發生網路或系統錯誤', 'error')
        }
      }, 300)

      cellDebounceMap.current.set(cellKey, timer)
    } catch {
      addToastRef.current('更新儲存格時發生網路或系統錯誤', 'error')
    }
  }, [setRows])

  /**
   * Update a cell value or multi-field object with optimistic update and debounce
   */
  const updateCell = useCallback(async (
    rowId: number,
    fieldKeyOrId: string | number | Record<string, CellValue>,
    value?: CellValue,
    skipPushHistory: boolean = false
  ) => {
    // Handle multi-field object update
    if (typeof fieldKeyOrId === 'object' && fieldKeyOrId !== null) {
      for (const [key, val] of Object.entries(fieldKeyOrId)) {
        await updateSingleCell(rowId, key, val, skipPushHistory)
      }
      return
    }

    await updateSingleCell(rowId, fieldKeyOrId, value, skipPushHistory)
  }, [updateSingleCell])

  /**
   * Batch update cells across multiple rows with 0ms optimistic update
   */
  const batchUpdateCells = useCallback(async (updates: Array<{ rowId: number; data: Record<string, CellValue> }>) => {
    const currentTableId = activeTableIdRef.current
    const currentRows = rowsRef.current

    if (!currentTableId || !Array.isArray(updates) || updates.length === 0) return
    const firstRowId = updates[0]?.rowId
    const targetRow = currentRows.find(r => r.id === firstRowId)
    const targetTableId = targetRow?.tableId || currentTableId

    // Collect before states for all updated rows & fields for undo history
    const historyEdits: Array<{ rowId: number; fieldKey: string; before: CellValue; after: CellValue }> = []
    updates.forEach(u => {
      const r = currentRows.find(row => row.id === u.rowId)
      if (r && u.data) {
        Object.entries(u.data).forEach(([fk, val]) => {
          historyEdits.push({
            rowId: u.rowId,
            fieldKey: fk,
            before: r.data[fk] ?? null,
            after: val
          })
        })
      }
    })

    try {
      // Optimistically update React state for ALL target rows immediately in 0ms
      const updateMap = new Map<number, Record<string, CellValue>>()
      updates.forEach(u => updateMap.set(u.rowId, u.data))

      setRows(prev => prev.map(r => {
        if (updateMap.has(r.id)) {
          const sData = updateMap.get(r.id) || {}
          const newRowData = { ...r.data, ...sData }
          normalizeRowData(newRowData)
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const newValues = (r as any).values ? { ...(r as any).values } : undefined
          if (newValues) {
            Object.entries(sData).forEach(([k, v]) => {
              const fid = parseInt(k.replace('field_', ''))
              if (!isNaN(fid)) newValues[fid] = v
            })
          }
          return { ...r, data: newRowData, ...(newValues && { values: newValues }) }
        }
        return r
      }))

      // Send 1 SINGLE HTTP request to batch update API
      const result = await rowService.batchUpdateRows(targetTableId, updates)
      if (result.ok && Array.isArray(result.updates)) {
        if (historyEdits.length > 0) {
          pushEditRef.current({
            tableId: targetTableId,
            edits: historyEdits
          })
        }
        const serverMap = new Map<number, Record<string, CellValue>>()
        result.updates.forEach(u => serverMap.set(u.rowId, u.data))

        setRows(prev => prev.map(r => {
          if (serverMap.has(r.id)) {
            const sData = serverMap.get(r.id) || {}
            const newRowData = { ...r.data, ...sData }
            normalizeRowData(newRowData)
            /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
            const newValues = (r as any).values ? { ...(r as any).values } : undefined
            if (newValues) {
              Object.entries(sData).forEach(([k, v]) => {
                const fid = parseInt(k.replace('field_', ''))
                if (!isNaN(fid)) newValues[fid] = v
              })
            }
            return { ...r, data: newRowData, ...(newValues && { values: newValues }) }
          }
          return r
        }))
      }
    } catch (err) {
      console.error('Batch update failed:', err)
      addToastRef.current('批次更新失敗', 'error')
    }
  }, [setRows])

  return {
    updateCell,
    batchUpdateCells,
  }
}
