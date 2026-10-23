/**
 * Database Module - Trash/Recycle Bin Service
 * Handles deleted items recovery and permanent deletion
 */

import { TrashItems, TrashEntry } from '../types'

/**
 * Fetch items in trash bin
 */
export const fetchTrashItems = async (tableId: number): Promise<TrashItems> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/trash`)
    if (res.ok) {
      const data = await res.json()
      return data as TrashItems
    }
    return { fields: [], rows: [] }
  } catch {
    return { fields: [], rows: [] }
  }
}

/**
 * Restore a deleted item from trash
 */
export const restoreTrashItem = async (
  tableId: number,
  type: 'field' | 'row',
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/trash`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', type, id }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '恢復失敗' }
  } catch {
    return { ok: false, error: '恢復失敗' }
  }
}

/**
 * Permanently delete an item from trash
 */
export const hardDeleteTrashItem = async (
  tableId: number,
  type: 'field' | 'row',
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/tables/${tableId}/trash?type=${type}&id=${id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '刪除失敗' }
  } catch {
    return { ok: false, error: '刪除失敗' }
  }
}

/**
 * Fetch recently deleted workspaces / databases / tables
 */
export const fetchRecentlyDeleted = async (): Promise<TrashEntry[]> => {
  try {
    const res = await fetch('/api/trash')
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []) as TrashEntry[]
  } catch {
    return []
  }
}

/**
 * Restore a recently deleted workspace / database / table
 */
export const restoreRecentlyDeleted = async (
  type: TrashEntry['type'],
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '還原失敗' }
  } catch {
    return { ok: false, error: '還原失敗' }
  }
}
