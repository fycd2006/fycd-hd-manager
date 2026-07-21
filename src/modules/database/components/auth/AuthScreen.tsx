'use client'

import React from 'react'
import { User } from '@/modules/database/types'

interface AuthScreenProps {
  authMode: 'login' | 'register'
  authUsername: string
  authEmail: string
  authPassword: string
  onAuthModeChange: (mode: 'login' | 'register') => void
  onAuthUsernameChange: (value: string) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: (e: React.FormEvent) => void
  onRegister: (e: React.FormEvent) => void
}

export default function AuthScreen({
  authMode,
  authUsername,
  authEmail,
  authPassword,
  onAuthModeChange,
  onAuthUsernameChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLogin,
  onRegister
}: AuthScreenProps) {
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

        <form onSubmit={authMode === 'login' ? onLogin : onRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>帳號名稱 (Username)</label>
            <input
              type="text"
              placeholder="請輸入帳號"
              value={authUsername}
              onChange={e => onAuthUsernameChange(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
              required
            />
          </div>

          {authMode === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>電子郵件 (Email)</label>
              <input
                type="email"
                placeholder="例如：jeff@example.com"
                value={authEmail}
                onChange={e => onAuthEmailChange(e.target.value)}
                style={{ padding: '10px 12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none' }}
                required
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
            />
          </div>

          <button
            type="submit"
            style={{ marginTop: '10px', padding: '12px', background: 'var(--accent-gradient)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 8px 18px rgba(37,99,235,0.18)' }}
          >
            {authMode === 'login' ? '登入系統' : '註冊帳號'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {authMode === 'login' ? (
            <span>
              還沒有帳戶？{' '}
              <button onClick={() => onAuthModeChange('register')} style={{ color: 'var(--accent-secondary)', fontWeight: 500 }}>
                立即註冊
              </button>
            </span>
          ) : (
            <span>
              已經有帳戶了？{' '}
              <button onClick={() => onAuthModeChange('login')} style={{ color: 'var(--accent-secondary)', fontWeight: 500 }}>
                立即登入
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
