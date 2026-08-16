'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Lock, User as UserIcon, Mail, ArrowRight, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'

interface AuthScreenProps {
  authMode: 'login' | 'register' | 'forgot-password' | 'reset-password'
  authUsername: string
  authEmail: string
  authPassword: string
  resetToken?: string
  errorMessage?: string | null
  onAuthModeChange: (mode: 'login' | 'register' | 'forgot-password' | 'reset-password') => void
  onAuthUsernameChange: (value: string) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: (e: React.FormEvent) => Promise<void>
  onRegister: (e: React.FormEvent) => Promise<void>
  onRequestResetPassword?: (email: string) => Promise<{ ok: boolean; message?: string; error?: string; devResetUrl?: string }>
  onResetPassword?: (newPassword: string) => Promise<{ ok: boolean; message?: string; error?: string }>
}

/**
 * Design Read:
 * "Reading this as: Auth Card for FYCD HD Manager enterprise workspace,
 * with Linear-style minimalist & high-contrast aesthetics, custom brand logo,
 * clear password toggle, forgot/reset password multi-step flows, and smooth spring feedback."
 */
export default function AuthScreen({
  authMode,
  authUsername,
  authEmail,
  authPassword,
  resetToken,
  errorMessage,
  onAuthModeChange,
  onAuthUsernameChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onLogin,
  onRegister,
  onRequestResetPassword,
  onResetPassword
}: AuthScreenProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // Reset password states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setLocalError(null)

    if (authMode === 'forgot-password') {
      if (!authEmail.trim()) {
        setLocalError(t('auth.enterEmail'))
        return
      }
      setSubmitting(true)
      try {
        if (onRequestResetPassword) {
          const result = await onRequestResetPassword(authEmail.trim())
          if (result.ok) {
            setResetSuccessMessage(result.message || t('auth.resetLinkSent'))
            if (result.devResetUrl) {
              setDevResetUrl(result.devResetUrl)
            }
          }
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (authMode === 'reset-password') {
      if (!newPassword) {
        setLocalError(t('auth.enterNewPassword'))
        return
      }
      if (newPassword !== confirmPassword) {
        setLocalError(t('auth.passwordMismatch'))
        return
      }
      if (newPassword.length < 8) {
        setLocalError('密碼長度至少需要 8 個字元')
        return
      }
      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        setLocalError('密碼必須包含大小寫英文字母與數字')
        return
      }

      setSubmitting(true)
      try {
        if (onResetPassword) {
          await onResetPassword(newPassword)
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

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

  const activeError = localError || errorMessage

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ffffff',
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
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <img 
            src="/logo.png" 
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
            {authMode === 'forgot-password'
              ? t('auth.forgotPasswordTitle')
              : authMode === 'reset-password'
              ? t('auth.resetPasswordTitle')
              : t('auth.systemTitle')}
          </p>
        </div>

        {/* Error Message Toast */}
        {activeError && (
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
            {activeError}
          </div>
        )}

        {/* ========================================================================= */}
        {/* FORGOT PASSWORD VIEW */}
        {/* ========================================================================= */}
        {authMode === 'forgot-password' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#52525b', lineHeight: 1.5, margin: '0 0 8px 0', textAlign: 'center' }}>
              {t('auth.forgotPasswordDesc')}
            </p>

            {resetSuccessMessage ? (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                alignItems: 'center',
                textAlign: 'center'
              }}>
                <CheckCircle2 size={32} color="#16a34a" />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#15803d' }}>
                  {resetSuccessMessage}
                </span>

                {devResetUrl && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px dashed #86efac',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#166534',
                    wordBreak: 'break-all'
                  }}>
                    <strong>[開發者快捷測試]</strong>
                    <br />
                    <a href={devResetUrl} style={{ color: '#15803d', textDecoration: 'underline', marginTop: '4px', display: 'inline-block' }}>
                      點擊此處直接進行密碼重設
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                    boxShadow: '0 4px 14px rgba(63, 98, 18, 0.25)',
                    transition: 'all 0.15s ease',
                    opacity: submitting ? 0.7 : 1
                  }}
                >
                  {submitting ? t('notifications.processing') : t('auth.sendResetLink')}
                </button>
              </form>
            )}

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setResetSuccessMessage(null)
                  setLocalError(null)
                  onAuthModeChange('login')
                }}
                style={{
                  color: '#52525b',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={14} />
                <span>{t('auth.backToLogin')}</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RESET PASSWORD VIEW */}
        {/* ========================================================================= */}
        {authMode === 'reset-password' && (
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#52525b', lineHeight: 1.5, margin: '0 0 6px 0', textAlign: 'center' }}>
              {t('auth.resetPasswordDesc')}
            </p>

            {/* New Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>{t('auth.newPasswordLabel')}</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <KeyRound size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.enterNewPassword')}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
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
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>{t('auth.confirmPasswordLabel')}</label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('auth.enterConfirmPassword')}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
                  required
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

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
            >
              {submitting ? t('notifications.processing') : t('auth.resetPasswordBtn')}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null)
                  onAuthModeChange('login')
                }}
                style={{
                  color: '#52525b',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={14} />
                <span>{t('auth.backToLogin')}</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* LOGIN & REGISTER VIEW */}
        {/* ========================================================================= */}
        {(authMode === 'login' || authMode === 'register') && (
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

            {/* Password Input with Show/Hide Toggle & Forgot Password Link */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#3f3f46' }}>{t('auth.passwordLabel')}</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalError(null)
                      onAuthModeChange('forgot-password')
                    }}
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#EA580C',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {t('auth.forgotPassword')}
                  </button>
                )}
              </div>
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#74C643', display: 'inline-block' }} />
                  <span style={{ width: '14px', height: '2px', backgroundColor: '#EA580C', borderRadius: '1px' }} />
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#F97316', display: 'inline-block' }} />
                  <span style={{ marginLeft: '4px' }}>{t('notifications.processing')}</span>
                </span>
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
        )}

        {/* Mode Switcher Link (Login <-> Register) */}
        {(authMode === 'login' || authMode === 'register') && (
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
        )}

      </div>
    </div>
  )
}
