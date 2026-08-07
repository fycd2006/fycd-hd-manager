'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon, Mail, ArrowRight, ShieldCheck } from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'

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
  const { t } = useI18n()
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fafafa',
      fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      {/* Container Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0,0,0,0.06)',
        padding: '36px 32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative'
      }}>
        {/* Language Picker in top right */}
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <LangPicker align="right" variant="subtle" />
        </div>

        {/* Brand / Logo Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '28px',
          textAlign: 'center'
        }}>
          <img 
            src="/logo.jpg" 
            alt="FYCD HD Manager Logo" 
            style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} 
          />
          <h1 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: 'var(--brand-orange-main, #EA580C)',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: '4px 0 0 0'
          }}>
            FYCD HD Manager
          </h1>
          <p style={{
            color: '#71717a',
            fontSize: '13.5px',
            margin: 0,
            fontWeight: 500
          }}>
            {t('auth.systemTitle')}
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
              {authMode === 'login' ? t('auth.usernameOrEmailLabel') : t('auth.usernameLabel')}
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <UserIcon size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={authMode === 'login' ? t('auth.enterUsernameOrEmail') : t('auth.enterUsername')}
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
                  e.currentTarget.style.borderColor = '#3F6212'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(63, 98, 18,0.12)'
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
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>{t('auth.emailLabel')}</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Mail size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  placeholder={t('auth.enterEmail')}
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
                    e.currentTarget.style.borderColor = '#3F6212'
                    e.currentTarget.style.backgroundColor = '#ffffff'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(63, 98, 18,0.12)'
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
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>{t('auth.passwordLabel')}</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.enterPassword')}
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
                  e.currentTarget.style.borderColor = '#3F6212'
                  e.currentTarget.style.backgroundColor = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(63, 98, 18,0.12)'
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: '#3F6212',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '6px',
              boxShadow: '0 4px 14px rgba(63, 98, 18, 0.25)',
              transition: 'all 0.15s ease',
              opacity: submitting ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!submitting) {
                e.currentTarget.style.backgroundColor = '#2d470d'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!submitting) {
                e.currentTarget.style.backgroundColor = '#3F6212'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            {submitting ? (
              <span>{t('notifications.processing')}</span>
            ) : authMode === 'login' ? (
              <>
                <span>{t('auth.loginTitle')}</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <span>{t('auth.registerTitle')}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher Link */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#71717a' }}>
          {authMode === 'login' ? (
            <span>
              {t('auth.noAccountPrompt')}{' '}
              <button
                type="button"
                onClick={() => onAuthModeChange('register')}
                style={{
                  color: '#18181B',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {t('auth.registerNow')}
              </button>
            </span>
          ) : (
            <span>
              {t('auth.hasAccountPrompt')}{' '}
              <button
                type="button"
                onClick={() => onAuthModeChange('login')}
                style={{
                  color: '#18181B',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {t('auth.loginNow')}
              </button>
            </span>
          )}
        </div>

      </div>
    </div>
  )
}
