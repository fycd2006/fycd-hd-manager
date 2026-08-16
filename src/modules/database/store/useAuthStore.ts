/**
 * Database Module - Authentication Store Hook
 * Manages user authentication state
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { User } from '../types'
import * as authService from '../services/auth'

export interface AuthState {
  currentUser: User | null
  authMode: 'login' | 'register' | 'forgot-password' | 'reset-password'
  authUsername: string
  authEmail: string
  authPassword: string
  resetToken: string
  authLoading: boolean
}

export interface AuthActions {
  setCurrentUser: (user: User | null) => void
  setAuthMode: (mode: 'login' | 'register' | 'forgot-password' | 'reset-password') => void
  setAuthUsername: (username: string) => void
  setAuthEmail: (email: string) => void
  setAuthPassword: (password: string) => void
  setResetToken: (token: string) => void
  setAuthLoading: (loading: boolean) => void
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  register: (username: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<boolean>
  updateProfile: (updates: { username?: string; oldPassword?: string; newPassword?: string }) => Promise<{ ok: boolean; error?: string }>
  requestPasswordReset: (email: string) => Promise<{ ok: boolean; message?: string; error?: string; devResetUrl?: string }>
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; message?: string; error?: string }>
}

export const useAuthStore = (): [AuthState, AuthActions] => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [authLoading, setAuthLoading] = useState(true)

  const login = useCallback(async (username: string, password: string) => {
    const result = await authService.login(username, password)
    if (result.ok && result.user) {
      setCurrentUser(result.user)
    }
    return { ok: result.ok, error: result.error }
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const result = await authService.register(username, email, password)
    if (result.ok && result.user) {
      setCurrentUser(result.user)
    }
    return { ok: result.ok, error: result.error }
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setCurrentUser(null)
  }, [])

  const checkAuth = useCallback(async () => {
    const result = await authService.checkAuth()
    if (result.authenticated && result.user) {
      setCurrentUser(result.user)
    }
    setAuthLoading(false)
    return result.authenticated
  }, [])

  const updateProfile = useCallback(async (updates: { username?: string; oldPassword?: string; newPassword?: string }) => {
    const result = await authService.updateProfile(updates)
    if (result.ok && result.user) {
      setCurrentUser(result.user)
    }
    return { ok: result.ok, error: result.error }
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    return await authService.requestPasswordReset(email)
  }, [])

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    return await authService.resetPassword(token, newPassword)
  }, [])

  const state: AuthState = {
    currentUser,
    authMode,
    authUsername,
    authEmail,
    authPassword,
    resetToken,
    authLoading,
  }

  const actions: AuthActions = useMemo(() => ({
    setCurrentUser,
    setAuthMode,
    setAuthUsername,
    setAuthEmail,
    setAuthPassword,
    setResetToken,
    setAuthLoading,
    login,
    register,
    logout,
    checkAuth,
    updateProfile,
    requestPasswordReset,
    resetPassword,
  }), [setCurrentUser, setAuthMode, setAuthUsername, setAuthEmail, setAuthPassword, setResetToken, setAuthLoading, login, register, logout, checkAuth, updateProfile, requestPasswordReset, resetPassword])

  return [state, actions]
}

