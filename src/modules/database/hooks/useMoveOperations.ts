'use client'

import { useCallback } from 'react'
import { getSocketId } from '@/lib/pusher-client'
import type { TableRow } from '@/modules/database/types'
import type { PendingOperation, TableAction } from '@/modules/database/hooks/useTableOperations'

interface UseMoveOperationsParams {
  activeTableId: number | null
  rows: TableRow[]
  operations: PendingOperation[]
  dispatch: React.Dispatch<TableAction>
  fetchTableData: (tableId: number) => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

export function useMoveOperations({
  activeTableId,
  rows,
  operations,
  dispatch,
  fetchTableData,
  addToast,
}: UseMoveOperationsParams) {
  const stageMoveRows = useCallback((rowIds: number[]) => {
    if (!activeTableId || rowIds.length === 0) return
    const id = `move_${Date.now()}`
    
    const rowsDataToMove = rows.filter(r => rowIds.includes(r.id)).map(r => ({
      sourceRowId: r.id,
      data: r.data
    }))
    
    if (rowsDataToMove.length === 0) return

    dispatch({
      type: 'ADD_OPERATION',
      payload: {
        id,
        type: 'move',
        status: 'staged',
        tableId: activeTableId,
        sourceRowIds: rowIds,
        rowsData: rowsDataToMove,
        createdAt: Date.now()
      }
    })
  }, [activeTableId, rows, dispatch])

  const cancelMoveRows = useCallback(() => {
    operations.forEach(op => {
      if (op.type === 'move' && op.status === 'staged') {
        dispatch({ type: 'REMOVE_OPERATION', payload: op.id })
      }
    })
  }, [operations, dispatch])

  const batchMoveRows = useCallback((): boolean => {
    const stagedOp = operations.find(op => op.type === 'move' && op.status === 'staged')
    if (!stagedOp || !activeTableId || !stagedOp.rowsData) return false

    const sourceTableId = stagedOp.tableId!
    const targetTableId = activeTableId
    const rowsToMove = stagedOp.rowsData
    
    const clientIds: string[] = []
    const movePayload = rowsToMove.map((r: { sourceRowId?: number; data?: Record<string, unknown> }) => {
      const clientId = `move_tmp_${Date.now()}_${Math.random().toString(36).substring(7)}`
      clientIds.push(clientId)
      return {
        sourceRowId: r.sourceRowId,
        data: r.data,
        clientId,
        order: 0
      }
    })

    dispatch({ type: 'REMOVE_OPERATION', payload: stagedOp.id })
    const pendingOpId = `move_pending_${Date.now()}`
    dispatch({
      type: 'ADD_OPERATION',
      payload: {
        id: pendingOpId,
        type: 'move',
        status: 'pending',
        tableId: sourceTableId,
        targetTableId: targetTableId,
        createdAt: Date.now()
      }
    })

    fetch(`/api/tables/${targetTableId}/rows/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceTableId,
        rows: movePayload,
        socket_id: getSocketId()
      })
    })
    .then(res => res.json())
    .then(data => {
      dispatch({ type: 'REMOVE_OPERATION', payload: pendingOpId })
      if (data.success && data.createdRows) {
        addToast(`成功搬移 ${data.createdRows.length} 筆資料`, 'success')
        if (targetTableId === activeTableId) {
           fetchTableData(targetTableId)
        }
      } else {
        addToast(data.error || '搬移失敗', 'error')
      }
    })
    .catch(() => {
      dispatch({ type: 'REMOVE_OPERATION', payload: pendingOpId })
      addToast('搬移失敗', 'error')
    })
    
    return true
  }, [operations, activeTableId, dispatch, fetchTableData, addToast])

  return {
    stageMoveRows,
    cancelMoveRows,
    batchMoveRows,
  }
}
