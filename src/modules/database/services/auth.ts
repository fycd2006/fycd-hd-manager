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
export const register = async (username: string, email: string, password: string): Promise<{ ok: boolean; user?: User; error?: string }> => {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, user: data.user }
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

/**
 * Update User Profile (username, password)
 */
export const updateProfile = async (updates: { username?: string; oldPassword?: string; newPassword?: string }): Promise<{ ok: boolean; user?: User; error?: string }> => {
  try {
    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (res.ok && data.user) {
      return { ok: true, user: data.user }
    }
    return { ok: false, error: data.error || '更新帳號設定失敗' }
  } catch {
    return { ok: false, error: '更新帳號設定失敗' }
  }
}

/**
 * Request password reset (Verify identity & get reset token)
 */
export const requestPasswordReset = async (username: string, email: string): Promise<{ ok: boolean; message?: string; error?: string; resetToken?: string }> => {
  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, message: data.message, resetToken: data.resetToken }
    }
    return { ok: false, error: data.error || '身分核對失敗' }
  } catch {
    return { ok: false, error: '身分核對失敗，請稍後再試' }
  }
}


/**
 * Reset password with token
 */
export const resetPassword = async (token: string, newPassword: string): Promise<{ ok: boolean; message?: string; error?: string }> => {
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      return { ok: true, message: data.message }
    }
    return { ok: false, error: data.error || '重設密碼失敗' }
  } catch {
    return { ok: false, error: '重設密碼失敗，請稍後再試' }
  }
}

