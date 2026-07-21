/**
 * Database Module - Workspace & Database Service
 * Handles workspace and database CRUD operations
 */

import { Workspace } from '../types'

/**
 * Fetch all workspaces with their databases and tables
 */
export const fetchWorkspaces = async (): Promise<Workspace[]> => {
  try {
    const res = await fetch('/api/workspaces')
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
 * Create a new workspace
 */
export const createWorkspace = async (name: string): Promise<{ ok: boolean; workspace?: Workspace; error?: string }> => {
  try {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_workspace', name }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, workspace: data }
    }
    return { ok: false, error: data.error || '建立工作區失敗' }
  } catch {
    return { ok: false, error: '建立工作區失敗' }
  }
}

/**
 * Create a new database within a workspace
 */
export const createDatabase = async (workspaceId: number, name: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_database', workspaceId, name }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '建立資料庫失敗' }
  } catch {
    return { ok: false, error: '建立資料庫失敗' }
  }
}

/**
 * Create a new table within a database
 */
export const createTable = async (databaseId: number, name: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_table', databaseId, name }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '建立資料表失敗' }
  } catch {
    return { ok: false, error: '建立資料表失敗' }
  }
}

/**
 * Delete a workspace or database
 */
export const deleteWorkspaceOrDatabase = async (
  action: 'delete_workspace' | 'delete_database',
  id: number
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/workspaces?action=${action}&id=${id}`, {
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
 * Rename a workspace, database, or table
 */
export const rename = async (type: 'workspace' | 'database' | 'table', id: number, name: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    let url = ''
    if (type === 'table') {
      url = `/api/tables/${id}`
    } else {
      url = '/api/workspaces'
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, name }),
    })

    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '重新命名失敗' }
  } catch {
    return { ok: false, error: '重新命名失敗' }
  }
}
