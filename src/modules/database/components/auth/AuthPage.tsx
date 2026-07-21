/**
 * Database Module - Authentication Page Component
 * Handles login and registration UI
 */

import React from 'react'
import { AuthState, AuthActions } from '../../store/useAuthStore'
import { ThemeState } from '../../store/useThemeStore'

interface AuthPageProps {
  authState: AuthState
  authActions: AuthActions
  themeState: ThemeState
}

export const AuthPage: React.FC<AuthPageProps> = ({ authState, authActions, themeState }) => {
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authState.authUsername || !authState.authPassword) return
    const result = await authActions.login(authState.authUsername, authState.authPassword)
    if (!result.ok) {
      console.error(result.error || '登入失敗')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authState.authUsername || !authState.authEmail || !authState.authPassword) return
    const result = await authActions.register(authState.authUsername, authState.authEmail, authState.authPassword)
    if (result.ok) {
      authActions.setAuthPassword('')
    } else {
      console.error(result.error || '註冊失敗')
    }
  }

  return (
    <div className={`auth-container theme-${themeState.theme}`}>
      <div className="auth-card">
        <h1>FYCD HD Manager</h1>
        
        {authState.authMode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>登入</h2>
            <div className="form-group">
              <label>用戶名</label>
              <input
                type="text"
                value={authState.authUsername}
                onChange={(e) => authActions.setAuthUsername(e.target.value)}
                placeholder="請輸入用戶名"
                required
              />
            </div>
            <div className="form-group">
              <label>密碼</label>
              <input
                type="password"
                value={authState.authPassword}
                onChange={(e) => authActions.setAuthPassword(e.target.value)}
                placeholder="請輸入密碼"
                required
              />
            </div>
            <button type="submit" disabled={authState.authLoading}>
              {authState.authLoading ? '載入中...' : '登入'}
            </button>
            <p className="auth-switch">
              還沒有帳號？{' '}
              <button type="button" onClick={() => authActions.setAuthMode('register')}>
                註冊
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <h2>註冊</h2>
            <div className="form-group">
              <label>用戶名</label>
              <input
                type="text"
                value={authState.authUsername}
                onChange={(e) => authActions.setAuthUsername(e.target.value)}
                placeholder="請輸入用戶名"
                required
              />
            </div>
            <div className="form-group">
              <label>電子郵件</label>
              <input
                type="email"
                value={authState.authEmail}
                onChange={(e) => authActions.setAuthEmail(e.target.value)}
                placeholder="請輸入電子郵件"
                required
              />
            </div>
            <div className="form-group">
              <label>密碼</label>
              <input
                type="password"
                value={authState.authPassword}
                onChange={(e) => authActions.setAuthPassword(e.target.value)}
                placeholder="請輸入密碼"
                required
              />
            </div>
            <button type="submit" disabled={authState.authLoading}>
              {authState.authLoading ? '載入中...' : '註冊'}
            </button>
            <p className="auth-switch">
              已有帳號？{' '}
              <button type="button" onClick={() => authActions.setAuthMode('login')}>
                登入
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
