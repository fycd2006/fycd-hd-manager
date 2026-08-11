/**
 * Database Module - Row Service
 * Handles row CRUD and data operations
 */

import { TableRow, CellValue } from '../types'
import { getSocketId } from '@/lib/pusher-client'

export interface FetchRowsResponse {
  rows: TableRow[]
  pagination?: {
    page: number
    pageSize: number
    totalRows: number
    totalPages: number
  }
}

/**
 * Fetch all rows for a table (with optional pagination, sort, filter)
 */
export function fetchRows(tableId: number): Promise<TableRow[]>
export function fetchRows(tableId: number, options: { page: number; pageSize?: number | 'all'; sort?: string; order?: 'asc' | 'desc'; filter?: string }): Promise<FetchRowsResponse>
export async function fetchRows(
  tableId: number,
  options?: { page?: number; pageSize?: number | 'all'; sort?: string; order?: 'asc' | 'desc'; filter?: string }
): Promise<TableRow[] | FetchRowsResponse> {
  try {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', String(options.page))
    if (options?.pageSize) params.append('pageSize', String(options.pageSize))
    if (options?.sort) params.append('sort', options.sort)
    if (options?.order) params.append('order', options.order)
    if (options?.filter) params.append('filter', options.filter)

    const queryString = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`/api/tables/${tableId}/rows${queryString}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) return data
      return data as FetchRowsResponse
    }
    return []
  } catch {
    return []
  }
}

/**
 * Create a new row
 */
export const createRow = async (tableId: number, data: Record<string, CellValue>): Promise<{ ok: boolean; row?: TableRow; error?: string }> => {
  try {
    const socketId = getSocketId()
    const res = await fetch(`/api/tables/${tableId}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, socket_id: socketId }),
    })
    const resData = await res.json()
    if (res.ok) {
      return { ok: true, row: resData }
    }
    return { ok: false, error: resData.error || '新增列失敗' }
  } catch {
    return { ok: false, error: '新增列失敗' }
  }
}

/**
 * Update a cell value
 */
export const updateCell = async (
  tableId: number,
  rowId: number,
  fieldKey: string,
  value: CellValue,
  options?: { signal?: AbortSignal }
): Promise<{ ok: boolean; row?: TableRow; error?: string }> => {
  try {
    const socketId = getSocketId()
    const res = await fetch(`/api/tables/${tableId}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, fieldKey, value, socket_id: socketId }),
      signal: options?.signal
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, row: data }
    }
    return { ok: false, error: data.error || '更新失敗' }
  } catch {
    return { ok: false, error: '更新失敗' }
  }
}

/**
 * Batch update multiple rows in a single HTTP request
 */
export const batchUpdateRows = async (
  tableId: number,
  updates: Array<{ rowId: number; data: Record<string, any> }>
): Promise<{ ok: boolean; updates?: Array<{ rowId: number; data: Record<string, any> }>; error?: string }> => {
  try {
    const socketId = getSocketId()
    const res = await fetch(`/api/tables/${tableId}/rows/batch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates, socket_id: socketId }),
    })
    const resData = await res.json()
    if (res.ok) {
      return { ok: true, updates: resData.updates }
    }
    return { ok: false, error: resData.error || '批次更新失敗' }
  } catch {
    return { ok: false, error: '批次更新失敗' }
  }
}

/**
 * Delete a row
 */
export const deleteRow = async (tableId: number, rowId: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const socketId = getSocketId()
    const query = socketId ? `?rowId=${rowId}&socket_id=${encodeURIComponent(socketId)}` : `?rowId=${rowId}`
    const res = await fetch(`/api/tables/${tableId}/rows${query}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.error || '刪除列失敗' }
  } catch {
    return { ok: false, error: '刪除列失敗' }
  }
}

/**
 * Reorder rows
 */
export const reorderRows = async (tableId: number, rowIds: number[]): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/rows/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIds }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '調整列順序失敗' }
  } catch {
    return { ok: false, error: '調整列順序失敗' }
  }
}

/**
 * Batch create multiple rows
 */
export const batchCreateRows = async (
  tableId: number,
  rows: Array<{ clientId: string; data: Record<string, any> }>
): Promise<{ ok: boolean; rows?: TableRow[]; error?: string }> => {
  try {
    const socketId = getSocketId()
    const res = await fetch(`/api/tables/${tableId}/rows/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, socket_id: socketId }),
    })
    const resData = await res.json()
    if (res.ok) {
      return { ok: true, rows: resData.rows }
    }
    return { ok: false, error: resData.error || '批次新增列失敗' }
  } catch {
    return { ok: false, error: '批次新增列失敗' }
  }
}

/**
 * Batch delete multiple rows
 */
export const batchDeleteRows = async (
  tableId: number,
  rowIds: number[]
): Promise<{ ok: boolean; count?: number; error?: string }> => {
  try {
    const socketId = getSocketId()
    const res = await fetch(`/api/tables/${tableId}/rows/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIds, socket_id: socketId }),
    })
    const resData = await res.json()
    if (res.ok) {
      return { ok: true, count: resData.count }
    }
    return { ok: false, error: resData.error || '批次刪除列失敗' }
  } catch {
    return { ok: false, error: '批次刪除列失敗' }
  }
}
