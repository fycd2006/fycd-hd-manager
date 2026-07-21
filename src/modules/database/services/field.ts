/**
 * Database Module - Field Service
 * Handles field CRUD operations
 */

import { TableField } from '../types'

/**
 * Fetch all fields for a table
 */
export const fetchFields = async (tableId: number): Promise<TableField[]> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields`)
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
 * Create a new field
 */
export const createField = async (
  tableId: number,
  field: Partial<TableField> & { type: string }
): Promise<{ ok: boolean; field?: TableField; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, field: data }
    }
    return { ok: false, error: data.error || '建立欄位失敗' }
  } catch {
    return { ok: false, error: '建立欄位失敗' }
  }
}

/**
 * Delete a field
 */
export const deleteField = async (tableId: number, fieldId: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields/${fieldId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '刪除欄位失敗' }
  } catch {
    return { ok: false, error: '刪除欄位失敗' }
  }
}

/**
 * Rename a field
 */
export const renameField = async (tableId: number, fieldId: number, name: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields/${fieldId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '重新命名欄位失敗' }
  } catch {
    return { ok: false, error: '重新命名欄位失敗' }
  }
}

/**
 * Reorder fields
 */
export const reorderFields = async (tableId: number, fieldOrder: number[]): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: fieldOrder }),
    })
    if (res.ok) {
      return { ok: true }
    }
    return { ok: false, error: '調整欄位順序失敗' }
  } catch {
    return { ok: false, error: '調整欄位順序失敗' }
  }
}

/**
 * Update a field
 */
export const updateField = async (tableId: number, fieldId: number, updates: Partial<TableField>): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/fields/${fieldId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '更新欄位失敗' }
  } catch {
    return { ok: false, error: '更新欄位失敗' }
  }
}
