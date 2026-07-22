/**
 * Database Module - Row Service
 * Handles row CRUD and data operations
 */

import { TableRow, CellValue } from '../types'

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
    const res = await fetch(`/api/tables/${tableId}/rows${queryString}`)
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
    const res = await fetch(`/api/tables/${tableId}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
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
  value: CellValue
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/rows`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, fieldKey, value }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '更新失敗' }
  } catch {
    return { ok: false, error: '更新失敗' }
  }
}

/**
 * Delete a row
 */
export const deleteRow = async (tableId: number, rowId: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/rows?rowId=${rowId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '刪除列失敗' }
  } catch {
    return { ok: false, error: '刪除列失敗' }
  }
}

/**
 * Duplicate a row
 */
export const duplicateRow = async (tableId: number, rowData: Record<string, CellValue>): Promise<{ ok: boolean; row?: TableRow; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/rows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: rowData }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, row: data }
    }
    return { ok: false, error: data.error || '複製列失敗' }
  } catch {
    return { ok: false, error: '複製列失敗' }
  }
}
