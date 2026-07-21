'use client'

import React, { useState } from 'react'

interface AuthScreenProps {
  authMode: 'login' | 'register'
  authUsername: string
  authEmail: string
  authPassword: string
  errorMessage?: string | null
  onAuthModeChange: (mode: 'login' | 'register') => void
  onAuthUsernameChange: (value: string) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: (e: React.FormEvent) => Promise<void>
  onRegister: (e: React.FormEvent) => Promise<void>
}

export default function AuthScreen({
  authMode,
  authUsername,
  authEmail,
  authPassword,
  errorMessage,
  onAuthModeChange,
  onAuthUsernameChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLogin,
  onRegister
}: AuthScreenProps) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      if (authMode === 'login') {
        await onLogin(e)
      } else {
        await onRegister(e)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #eef4ff 0%, #f8fafc 45%, #eef2f7 100%)', color: 'var(--text-primary)', fontFamily: 'inherit' }}>
      <div style={{ background: 'var(--bg-secondary)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '420px', width: '100%', boxShadow: '0 20px 60px rgba(15, 23, 42, 0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--accent-gradient)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 10px 20px rgba(37,99,235,0.2)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
            </svg>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Baserow</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Baserow-like database workspace</p>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {authMode === 'login' ? '帳號名稱或 Email (Username or Email)' : '帳號名稱 (Username)'}
            </label>
            <input
              type="text"
              placeholder={authMode === 'login' ? '請輸入帳號或電子郵件' : '請輸入帳號'}
              value={authUsername}
              onChange={e => onAuthUsernameChange(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              required
              disabled={submitting}
            />
          </div>

          {authMode === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>電子郵件 (Email)</label>
              <input
                type="email"
                placeholder="例如：user@example.com"
                value={authEmail}
                onChange={e => onAuthEmailChange(e.target.value)}
                style={{ padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                required
                disabled={submitting}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>登入密碼 (Password)</label>
            <input
              type="password"
              placeholder="請輸入密碼"
              value={authPassword}
              onChange={e => onAuthPasswordChange(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '10px',
              padding: '12px',
              background: submitting ? '#94a3b8' : 'var(--accent-gradient)',
              border: 'none',
              color: 'white',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: submitting ? 'none' : '0 8px 18px rgba(37,99,235,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {submitting ? (
              <span>處理中...</span>
            ) : authMode === 'login' ? (
              '登入系統'
            ) : (
              '註冊帳號'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {authMode === 'login' ? (
            <span>
              還沒有帳戶？{' '}
              <button
                type="button"
                onClick={() => onAuthModeChange('register')}
                style={{ color: 'var(--accent-secondary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                立即註冊
              </button>
            </span>
          ) : (
            <span>
              已經有帳戶了？{' '}
              <button
                type="button"
                onClick={() => onAuthModeChange('login')}
                style={{ color: 'var(--accent-secondary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                立即登入
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

