'use client'

import { useEffect, useRef } from 'react'
import { getPusherClient } from '@/lib/pusher-client'
import { normalizeRowData } from '@/modules/database/utils/normalizeRowData'
import type { TableRow, CellValue, TableField } from '@/modules/database/types'

interface RowUpdatedPayload {
  rowId: number
  data?: Record<string, CellValue>
  affectedRows?: Array<{ id: number; data?: Record<string, CellValue> }>
}

interface RowsBatchUpdatedPayload {
  updates?: Array<{ rowId: number; data?: Record<string, CellValue> }>
}

interface RowCreatedPayload {
  row?: TableRow
}

interface RowDeletedPayload {
  rowId?: number
}

interface FieldUpdatedPayload {
  field?: TableField
}

interface FieldCreatedPayload {
  field?: TableField
}

interface FieldDeletedPayload {
  fieldId?: number
}

interface FieldsReorderedPayload {
  order?: number[]
}

interface UseRealtimeSyncParams {
  activeTableId: number | null
  setRows: (payload: TableRow[] | ((prev: TableRow[]) => TableRow[])) => void
  setFields?: (payload: TableField[] | ((prev: TableField[]) => TableField[])) => void
  fetchTableData: (tableId: number) => Promise<void>
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

/**
 * Manages Pusher WebSocket subscriptions for real-time multi-user sync.
 * Subscribes to the active table's channel and handles row CRUD events.
 */
export function useRealtimeSync({ activeTableId, setRows, setFields, fetchTableData, addToast }: UseRealtimeSyncParams) {
  const setRowsRef = useRef(setRows)
  const setFieldsRef = useRef(setFields)
  const fetchTableDataRef = useRef(fetchTableData)
  const addToastRef = useRef(addToast)

  useEffect(() => {
    setRowsRef.current = setRows
    setFieldsRef.current = setFields
    fetchTableDataRef.current = fetchTableData
    addToastRef.current = addToast
  })

  useEffect(() => {
    if (!activeTableId) return
    const pusher = getPusherClient()
    if (!pusher) return

    const channelName = `table-${activeTableId}`
    const channel = pusher.subscribe(channelName)

    const handleStateChange = (states: { previous: string; current: string }) => {
      if (['unavailable', 'disconnected', 'failed'].includes(states.current)) {
        addToastRef.current('網路連線中斷，正在嘗試重新連線...', 'info')
      } else if (['unavailable', 'disconnected', 'failed', 'connecting'].includes(states.previous) && states.current === 'connected') {
        addToastRef.current('網路已重新連線，正在進行全量資料同步...', 'info')
        if (activeTableId) {
          fetchTableDataRef.current(activeTableId)
        }
      }
    }

    if (pusher.connection) {
      pusher.connection.bind('state_change', handleStateChange)
    }

    channel.bind('row-updated', (data: RowUpdatedPayload | undefined) => {
      if (!data) return
      const { rowId, data: rowData, affectedRows } = data

      setRowsRef.current(prev => prev.map(r => {
        if (r.id === rowId && rowData) {
          const newData = { ...r.data, ...rowData } as Record<string, CellValue>
          normalizeRowData(newData)
          return { ...r, data: newData }
        }
        return r
      }))

      if (Array.isArray(affectedRows) && affectedRows.length > 0) {
        const affectedMap = new Map<number, Record<string, CellValue>>()
        affectedRows.forEach(ar => affectedMap.set(ar.id, ar.data || {}))
        setRowsRef.current(prev => prev.map(r => {
          if (affectedMap.has(r.id)) {
            const newData = { ...r.data, ...affectedMap.get(r.id) } as Record<string, CellValue>
            normalizeRowData(newData)
            return { ...r, data: newData }
          }
          return r
        }))
      }
    })

    channel.bind('rows-batch-updated', (data: RowsBatchUpdatedPayload | undefined) => {
      if (!data || !Array.isArray(data.updates)) return
      const updateMap = new Map<number, Record<string, CellValue>>()
      data.updates.forEach(u => updateMap.set(u.rowId, u.data || {}))
      setRowsRef.current(prev => prev.map(r => {
        if (updateMap.has(r.id)) {
          const newData = { ...r.data, ...updateMap.get(r.id) } as Record<string, CellValue>
          normalizeRowData(newData)
          return { ...r, data: newData }
        }
        return r
      }))
    })

    channel.bind('row-created', (data: RowCreatedPayload | undefined) => {
      if (!data?.row) return
      const createdRow = data.row
      setRowsRef.current(prev => {
        if (prev.some(r => r.id === createdRow.id)) return prev
        return [...prev, createdRow]
      })
    })

    channel.bind('row-deleted', (data: RowDeletedPayload | undefined) => {
      if (!data?.rowId) return
      const deletedId = data.rowId
      setRowsRef.current(prev => prev.filter(r => r.id !== deletedId))
    })

    channel.bind('field-updated', (data: FieldUpdatedPayload | undefined) => {
      if (!data?.field) return
      const updatedField = data.field
      if (setFieldsRef.current) {
        setFieldsRef.current(prev => prev.map(f => f.id === updatedField.id ? { ...f, ...updatedField } : f))
      }
    })

    channel.bind('field-created', (data: FieldCreatedPayload | undefined) => {
      if (!data?.field) return
      const newField = data.field
      if (setFieldsRef.current) {
        setFieldsRef.current(prev => {
          if (prev.some(f => f.id === newField.id)) {
            return prev.map(f => f.id === newField.id ? { ...f, ...newField } : f)
          }
          return [...prev, newField].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        })
      }
    })

    channel.bind('field-deleted', (data: FieldDeletedPayload | undefined) => {
      if (!data?.fieldId) return
      const deletedId = data.fieldId
      if (setFieldsRef.current) {
        setFieldsRef.current(prev => prev.filter(f => f.id !== deletedId))
      }
    })

    channel.bind('fields-reordered', () => {
      if (activeTableId) {
        fetchTableDataRef.current(activeTableId)
      }
    })

    channel.bind('rows-batch-changed', () => {
      if (activeTableId) {
        fetchTableDataRef.current(activeTableId)
      }
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(channelName)
      if (pusher.connection) {
        pusher.connection.unbind('state_change', handleStateChange)
      }
    }
  }, [activeTableId])
}

