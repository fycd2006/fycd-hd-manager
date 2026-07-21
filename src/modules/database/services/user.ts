/**
 * Database Module - User Management Service
 * Handles user role and permission operations
 */

import { User } from '../types'

/**
 * Fetch all system users
 */
export const fetchUsers = async (): Promise<User[]> => {
  try {
    const res = await fetch('/api/users')
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
 * Change a user's role
 */
export const changeUserRole = async (userId: number, role: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    })
    if (res.ok) {
      return { ok: true }
    }
    const data = await res.json()
    return { ok: false, error: data.error || '變更失敗' }
  } catch {
    return { ok: false, error: '變更失敗' }
  }
}

/**
 * Delete a system user
 */
export const deleteUser = async (userId: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/users?userId=${userId}`, {
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
