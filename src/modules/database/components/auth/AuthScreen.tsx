'use client'

import React, { useEffect, useId, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls, useReducedMotion } from 'motion/react'
import { Eye, EyeOff, Lock, User as UserIcon, Mail, ArrowRight, ArrowLeft, KeyRound, type LucideIcon } from 'lucide-react'
import { LangPicker } from '@/modules/database/components/navigation/LangPicker'
import { useI18n } from '@/lib/i18n/i18nContext'
import { FycdLogo } from '@/components/brand/FycdLogo'
import styles from './AuthScreen.module.css'

type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password'

interface AuthScreenProps {
  authMode: AuthMode
  authUsername: string
  authEmail: string
  authPassword: string
  resetToken?: string
  errorMessage?: string | null
  /** 登入／註冊成功、品牌載入層即將覆蓋時為 true：卡片淡出且不再接受送出 */
  leaving?: boolean
  onAuthModeChange: (mode: AuthMode) => void
  onAuthUsernameChange: (value: string) => void
  onAuthEmailChange: (value: string) => void
  onAuthPasswordChange: (value: string) => void
  onLogin: (e: React.FormEvent) => Promise<void>
  onRegister: (e: React.FormEvent) => Promise<void>
  onRequestResetPassword?: (username: string, email: string) => Promise<{ ok: boolean; message?: string; error?: string; resetToken?: string }>
  onResetPassword?: (newPassword: string) => Promise<{ ok: boolean; message?: string; error?: string }>
}

const EASE_OUT: [number, number, number, number] = [0.2, 0.8, 0.2, 1]

interface FieldProps {
  label: string
  icon: LucideIcon
  type: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
  autoComplete?: string
  labelAction?: React.ReactNode
  reveal?: { shown: boolean; onToggle: () => void }
}

function Field({ label, icon: Icon, type, placeholder, value, onChange, disabled, autoComplete, labelAction, reveal }: FieldProps) {
  const inputType = reveal ? (reveal.shown ? 'text' : 'password') : type
  const inputId = useId()
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId} className={styles.label}>{label}</label>
        {labelAction}
      </div>
      <div className={styles.inputWrap}>
        <Icon size={16} className={styles.iconLeft} aria-hidden="true" />
        <input
          id={inputId}
          className={`${styles.input} ${reveal ? styles.withToggle : ''}`}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          disabled={disabled}
        />
        {reveal && (
          <button
            type="button"
            className={styles.toggle}
            onClick={reveal.onToggle}
            aria-label={reveal.shown ? '隱藏密碼' : '顯示密碼'}
          >
            {reveal.shown ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 登入卡片：FYCD HD 品牌字標、沉穩極簡的米白底與白色卡片，
 * 進場、模式切換、錯誤提示皆有對應動畫（尊重 prefers-reduced-motion）。
 */
export default function AuthScreen({
  authMode,
  authUsername,
  authEmail,
  authPassword,
  errorMessage,
  leaving = false,
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
  const reduceMotion = useReducedMotion()
  const shake = useAnimationControls()
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Reset password states
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const activeError = localError || errorMessage

  useEffect(() => {
    if (activeError && !reduceMotion) {
      shake.start({ x: [0, -6, 6, -3, 3, 0], transition: { duration: 0.35 } })
    }
  }, [activeError, reduceMotion, shake])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || leaving) return
    setLocalError(null)

    if (authMode === 'forgot-password') {
      if (!authUsername.trim()) {
        setLocalError(t('auth.enterUsername'))
        return
      }
      if (!authEmail.trim()) {
        setLocalError(t('auth.enterEmail'))
        return
      }
      setSubmitting(true)
      try {
        if (onRequestResetPassword) {
          const result = await onRequestResetPassword(authUsername.trim(), authEmail.trim())
          if (result.ok) {
            onAuthModeChange('reset-password')
          } else {
            setLocalError(result.error || '帳號名稱與電子郵件不符，請確認後重試')
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
          const result = await onResetPassword(newPassword)
          if (result.ok) {
            setNewPassword('')
            setConfirmPassword('')
          } else {
            setLocalError(result.error || '密碼重設失敗，請稍後再試')
          }
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

  const backToLogin = () => {
    setLocalError(null)
    onAuthModeChange('login')
  }

  const disabled = submitting || leaving

  const submitLabel =
    authMode === 'forgot-password' ? t('auth.verifyAndReset')
    : authMode === 'reset-password' ? t('auth.resetPasswordBtn')
    : authMode === 'login' ? t('auth.loginTitle')
    : t('auth.registerTitle')

  const subtitle =
    authMode === 'forgot-password' ? t('auth.forgotPasswordTitle')
    : authMode === 'reset-password' ? t('auth.resetPasswordTitle')
    : t('auth.systemTitle')

  const cardTransition = reduceMotion
    ? { duration: 0 }
    : { duration: leaving ? 0.25 : 0.45, ease: EASE_OUT }

  const swap = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.2, ease: EASE_OUT },
      }

  return (
    <div className={styles.page}>
      <div className={styles.langPicker}>
        <LangPicker align="right" variant="subtle" />
      </div>
      <motion.div className={styles.shell} animate={shake}>
        <motion.div
          className={styles.card}
          layout={!reduceMotion}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={leaving ? { opacity: 0, scale: 0.98, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
          transition={cardTransition}
        >
          {/* Brand / Logo Header */}
          <motion.div layout={!reduceMotion ? 'position' : false} className={styles.brand}>
            <h1 className={styles.srOnly}>FYCD HD Manager</h1>
            <FycdLogo variant="full" animated height={44} />
            <p className={styles.subtitle}>{subtitle}</p>
          </motion.div>

          {/* Error Message */}
          <AnimatePresence initial={false}>
            {activeError && (
              <motion.div
                key="error"
                className={styles.error}
                role="alert"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE_OUT }}
              >
                <div className={styles.errorInner}>{activeError}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.form key={authMode} onSubmit={handleSubmit} className={styles.form} {...swap}>
              {authMode === 'forgot-password' && (
                <>
                  {/* 雙重身分核對 */}
                  <p className={styles.desc}>{t('auth.forgotPasswordDesc')}</p>
                  <Field
                    label={t('auth.usernameLabel')}
                    icon={UserIcon}
                    type="text"
                    placeholder={t('auth.enterUsername')}
                    value={authUsername}
                    onChange={onAuthUsernameChange}
                    autoComplete="username"
                    disabled={disabled}
                  />
                  <Field
                    label={t('auth.emailLabel')}
                    icon={Mail}
                    type="email"
                    placeholder={t('auth.enterEmail')}
                    value={authEmail}
                    onChange={onAuthEmailChange}
                    autoComplete="email"
                    disabled={disabled}
                  />
                </>
              )}

              {authMode === 'reset-password' && (
                <>
                  <p className={styles.desc}>{t('auth.resetPasswordDesc')}</p>
                  <Field
                    label={t('auth.newPasswordLabel')}
                    icon={KeyRound}
                    type="password"
                    placeholder={t('auth.enterNewPassword')}
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    disabled={disabled}
                    reveal={{ shown: showPassword, onToggle: () => setShowPassword(!showPassword) }}
                  />
                  <Field
                    label={t('auth.confirmPasswordLabel')}
                    icon={Lock}
                    type="password"
                    placeholder={t('auth.enterConfirmPassword')}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    disabled={disabled}
                    reveal={{ shown: showConfirmPassword, onToggle: () => setShowConfirmPassword(!showConfirmPassword) }}
                  />
                </>
              )}

              {(authMode === 'login' || authMode === 'register') && (
                <>
                  <Field
                    label={authMode === 'login' ? t('auth.usernameOrEmailLabel') : t('auth.usernameLabel')}
                    icon={UserIcon}
                    type="text"
                    placeholder={authMode === 'login' ? t('auth.enterUsernameOrEmail') : t('auth.enterUsername')}
                    value={authUsername}
                    onChange={onAuthUsernameChange}
                    autoComplete="username"
                    disabled={disabled}
                  />
                  {authMode === 'register' && (
                    <Field
                      label={t('auth.emailLabel')}
                      icon={Mail}
                      type="email"
                      placeholder={t('auth.enterEmail')}
                      value={authEmail}
                      onChange={onAuthEmailChange}
                      autoComplete="email"
                      disabled={disabled}
                    />
                  )}
                  <Field
                    label={t('auth.passwordLabel')}
                    icon={Lock}
                    type="password"
                    placeholder={t('auth.enterPassword')}
                    value={authPassword}
                    onChange={onAuthPasswordChange}
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    disabled={disabled}
                    reveal={{ shown: showPassword, onToggle: () => setShowPassword(!showPassword) }}
                    labelAction={authMode === 'login' && (
                      <button
                        type="button"
                        className={`${styles.linkBtn} ${styles.forgotLink}`}
                        onClick={() => {
                          setLocalError(null)
                          onAuthModeChange('forgot-password')
                        }}
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    )}
                  />
                </>
              )}

              <button type="submit" className={styles.primaryBtn} aria-busy={submitting}>
                {submitting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    <span>{t('notifications.processing')}</span>
                  </>
                ) : (
                  <>
                    <span>{submitLabel}</span>
                    {(authMode === 'login' || authMode === 'register') && (
                      <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />
                    )}
                  </>
                )}
              </button>

              {(authMode === 'forgot-password' || authMode === 'reset-password') && (
                <div className={styles.center}>
                  <button type="button" className={styles.linkBtn} onClick={backToLogin}>
                    <ArrowLeft size={14} aria-hidden="true" />
                    <span>{t('auth.backToLogin')}</span>
                  </button>
                </div>
              )}
            </motion.form>
          </AnimatePresence>

          {/* Mode Switcher Link (Login <-> Register) */}
          {(authMode === 'login' || authMode === 'register') && (
            <motion.div layout={!reduceMotion ? 'position' : false} className={styles.switcher}>
              {authMode === 'login' ? t('auth.noAccountPrompt') : t('auth.hasAccountPrompt')}{' '}
              <button
                type="button"
                className={`${styles.linkBtn} ${styles.switcherLink}`}
                onClick={() => onAuthModeChange(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? t('auth.registerNow') : t('auth.loginNow')}
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
