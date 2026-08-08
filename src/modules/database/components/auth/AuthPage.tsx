/**
 * Database Module - Authentication Page Component
 * Handles login and registration UI
 */

import React from 'react'
import { AuthState, AuthActions } from '../../store/useAuthStore'
import { ThemeState } from '../../store/useThemeStore'
import { useI18n } from '@/lib/i18n/i18nContext'

interface AuthPageProps {
  authState: AuthState
  authActions: AuthActions
  themeState: ThemeState
}

export const AuthPage: React.FC<AuthPageProps> = ({ authState, authActions, themeState }) => {
  const { t } = useI18n()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authState.authUsername || !authState.authPassword) return
    const result = await authActions.login(authState.authUsername, authState.authPassword)
    if (!result.ok) {
      console.error(result.error || t('auth.loginFailed'))
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authState.authUsername || !authState.authEmail || !authState.authPassword) return
    const result = await authActions.register(authState.authUsername, authState.authEmail, authState.authPassword)
    if (result.ok) {
      authActions.setAuthPassword('')
    } else {
      console.error(result.error || t('auth.registerFailed'))
    }
  }

  return (
    <div className={`auth-container theme-${themeState.theme}`}>
      <div className="auth-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img 
          src="/logo.png" 
          alt="FYCD HD Manager Logo" 
          style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', marginBottom: '12px', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', border: '2px solid #ffffff' }} 
        />
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', color: 'var(--brand-orange-main, #EA580C)', letterSpacing: '-0.02em' }}>
          FYCD HD Manager
        </h1>
        
        {authState.authMode === 'login' ? (
          <form onSubmit={handleLogin} className="auth-form">
            <h2>{t('auth.login')}</h2>
            <div className="form-group">
              <label>{t('auth.usernameLabel')}</label>
              <input
                type="text"
                value={authState.authUsername}
                onChange={(e) => authActions.setAuthUsername(e.target.value)}
                placeholder={t('auth.enterUsername')}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('auth.passwordLabel')}</label>
              <input
                type="password"
                value={authState.authPassword}
                onChange={(e) => authActions.setAuthPassword(e.target.value)}
                placeholder={t('auth.enterPassword')}
                required
              />
            </div>
            <button type="submit" disabled={authState.authLoading}>
              {authState.authLoading ? t('notifications.processing') : t('auth.login')}
            </button>
            <p className="auth-switch">
              {t('auth.noAccountPrompt')}{' '}
              <button type="button" onClick={() => authActions.setAuthMode('register')}>
                {t('auth.register')}
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="auth-form">
            <h2>{t('auth.register')}</h2>
            <div className="form-group">
              <label>{t('auth.usernameLabel')}</label>
              <input
                type="text"
                value={authState.authUsername}
                onChange={(e) => authActions.setAuthUsername(e.target.value)}
                placeholder={t('auth.enterUsername')}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('auth.emailLabel')}</label>
              <input
                type="email"
                value={authState.authEmail}
                onChange={(e) => authActions.setAuthEmail(e.target.value)}
                placeholder={t('auth.enterEmail')}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('auth.passwordLabel')}</label>
              <input
                type="password"
                value={authState.authPassword}
                onChange={(e) => authActions.setAuthPassword(e.target.value)}
                placeholder={t('auth.enterPassword')}
                required
              />
            </div>
            <button type="submit" disabled={authState.authLoading}>
              {authState.authLoading ? t('notifications.processing') : t('auth.register')}
            </button>
            <p className="auth-switch">
              {t('auth.hasAccountPrompt')}{' '}
              <button type="button" onClick={() => authActions.setAuthMode('login')}>
                {t('auth.login')}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

