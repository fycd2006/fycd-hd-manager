/**
 * Database Module - Authentication Service
 * Handles user login, register, and authentication
 */

import { User } from '../types'

/**
 * Check current authentication status
 */
export const checkAuth = async (): Promise<{ authenticated: boolean; user: User | null }> => {
  try {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const data = await res.json()
      return data
    }
    return { authenticated: false, user: null }
  } catch {
    return { authenticated: false, user: null }
  }
}

/**
 * Login with username and password
 */
export const login = async (username: string, password: string): Promise<{ ok: boolean; user?: User; error?: string }> => {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, user: data.user }
    }
    return { ok: false, error: data.error || '登入失敗' }
  } catch (err) {
    return { ok: false, error: '登入失敗，請稍後再試' }
  }
}

/**
 * Register a new account
 */
export const register = async (username: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true }
    }
    return { ok: false, error: data.error || '註冊失敗' }
  } catch {
    return { ok: false, error: '註冊失敗，請稍後再試' }
  }
}

/**
 * Logout
 */
export const logout = async (): Promise<void> => {
  try {
    await fetch('/api/auth/me', { method: 'POST' })
  } catch {
    // Ignore errors during logout
  }
}
