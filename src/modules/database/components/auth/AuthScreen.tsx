'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon, Mail, ArrowRight, ShieldCheck } from 'lucide-react'

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

/**
 * Design Read:
 * "Reading this as: Auth Card for FYCD HD Manager enterprise workspace,
 * with Linear-style minimalist & high-contrast aesthetics, custom brand logo,
 * clear password toggle, and smooth spring feedback."
 */
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
  const [showPassword, setShowPassword] = useState(false)

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
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top, #eef4ff 0%, #f8fafc 50%, #e2e8f0 100%)',
      fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#09090b',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        padding: '44px 40px',
        borderRadius: '24px',
        border: '1px solid #e4e4e7',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 24px 64px rgba(15, 23, 42, 0.1), 0 4px 12px rgba(15, 23, 42, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}>
        
        {/* Brand Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          <img
            src="/logo.jpg"
            alt="FYCD HD Manager Logo"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: '16px',
              boxShadow: '0 8px 24px rgba(37,99,235,0.18)',
              border: '3px solid #ffffff',
              outline: '1px solid #e4e4e7'
            }}
          />
          <h1 style={{
            fontSize: '26px',
            fontWeight: 800,
            margin: '0 0 6px 0',
            color: '#09090b',
            letterSpacing: '-0.03em',
            lineHeight: 1.2
          }}>
            FYCD HD Manager
          </h1>
          <p style={{
            color: '#71717a',
            fontSize: '13.5px',
            margin: 0,
            fontWeight: 500
          }}>
            雲端資料庫與團隊工作區管理系統
          </p>
        </div>

        {/* Error Message Toast */}
        {errorMessage && (
          <div style={{
            width: '100%',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            marginBottom: '20px',
            fontWeight: 600,
            boxSizing: 'border-box',
            textAlign: 'center'
          }}>
            {errorMessage}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Username Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>
              {authMode === 'login' ? '帳號名稱或電子郵件 (Username / Email)' : '帳號名稱 (Username)'}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <UserIcon size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={authMode === 'login' ? '請輸入帳號或 Email' : '請設定帳號名稱'}
                value={authUsername}
                onChange={e => onAuthUsernameChange(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 14px 0 40px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  color: '#09090b',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e4e4e7'
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                required
                disabled={submitting}
              />
            </div>
          </div>

          {/* Email Input (Register only) */}
          {authMode === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>電子郵件 (Email)</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  placeholder="例如：user@example.com"
                  value={authEmail}
                  onChange={e => onAuthEmailChange(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    padding: '0 14px 0 40px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    color: '#09090b',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb'
                    e.currentTarget.style.backgroundColor = '#ffffff'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e4e4e7'
                    e.currentTarget.style.backgroundColor = '#f8fafc'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  required
                  disabled={submitting}
                />
              </div>
            </div>
          )}

          {/* Password Input with Show/Hide Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>登入密碼 (Password)</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="請輸入密碼"
                value={authPassword}
                onChange={e => onAuthPasswordChange(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 40px 0 40px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e4e4e7',
                  borderRadius: '12px',
                  color: '#09090b',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e4e4e7'
                  e.currentTarget.style.backgroundColor = '#f8fafc'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              marginTop: '8px',
              height: '46px',
              backgroundColor: submitting ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14.5px',
              fontWeight: 700,
              cursor: submitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: submitting ? 'none' : '0 8px 20px rgba(37,99,235,0.25)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.backgroundColor = '#1d4ed8'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.backgroundColor = '#2563eb'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {submitting ? (
              <span>處理中...</span>
            ) : authMode === 'login' ? (
              <>
                <span>登入系統</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>註冊帳號</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher Link */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#71717a' }}>
          {authMode === 'login' ? (
            <span>
              還沒有帳戶？{' '}
              <button
                type="button"
                onClick={() => onAuthModeChange('register')}
                style={{
                  color: '#2563eb',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
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
                style={{
                  color: '#2563eb',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
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
