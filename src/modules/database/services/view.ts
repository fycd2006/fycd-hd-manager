/**
 * Database Module - View Service
 * Handles view CRUD and configuration operations
 */

import { TableView, ViewConfigPatch } from '../types'

/**
 * Fetch all views for a table
 */
export const fetchViews = async (tableId: number): Promise<TableView[]> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/views`)
    if (res.ok) {
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }
    return []
  } catch {
    return []
  }
}

/**
 * Create a new view
 */
export const createView = async (
  tableId: number,
  name: string,
  type: string
): Promise<{ ok: boolean; view?: TableView; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, view: data }
    }
    return { ok: false, error: data.error || '建立檢視失敗' }
  } catch {
    return { ok: false, error: '建立檢視失敗' }
  }
}

/**
 * Update view configuration
 */
export const updateViewConfig = async (
  tableId: number,
  viewId: number,
  changes: ViewConfigPatch
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/views`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewId, ...changes }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '更新檢視失敗' }
  } catch {
    return { ok: false, error: '更新檢視失敗' }
  }
}

/**
 * Delete a view
 */
export const deleteView = async (tableId: number, viewId: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/views?viewId=${viewId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '刪除檢視失敗' }
  } catch {
    return { ok: false, error: '刪除檢視失敗' }
  }
}
