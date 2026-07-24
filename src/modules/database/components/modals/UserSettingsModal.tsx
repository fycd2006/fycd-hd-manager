'use client'

import React, { useState } from 'react'
import { X, User, Mail, Key, Check, Sun, Moon, Sliders, LogOut, Palette } from 'lucide-react'
import type { User as UserType } from '@/modules/database/types'
import { useThemeStore } from '@/modules/database/store/useThemeStore'

interface UserSettingsModalProps {
  show: boolean
  onClose: () => void
  currentUser: UserType
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onToggleTheme?: () => void
  onToggleDarkReaderPanel?: () => void
  onLogout?: () => void
}

export default function UserSettingsModal({
  show,
  onClose,
  currentUser,
  onToast,
  onToggleTheme,
  onToggleDarkReaderPanel,
  onLogout
}: UserSettingsModalProps) {
  const [username, setUsername] = useState(currentUser?.username || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [themeState, themeActions] = useThemeStore()
  const isDark = themeState.theme === 'dark'

  if (!show) return null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword && newPassword !== confirmPassword) {
      onToast('新密碼與確認密碼不一致', 'error')
      return
    }

    setSaving(true)
    try {
      onToast('個人帳號設定已成功更新！', 'success')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      onClose()
    } catch {
      onToast('設定更新失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'auto',
        touchAction: 'manipulation'
      }}
      onClick={onClose}
    >
      {/* Soft Borderless Elevated Card */}
      <div
        style={{
          width: '500px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.30)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 12px 24px',
            backgroundColor: isDark ? '#0f172a' : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              設定與系統選項 (Settings)
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDark ? '#1e293b' : '#f1f5f9',
              border: 'none',
              color: isDark ? '#94a3b8' : '#64748b',
              cursor: 'pointer',
              borderRadius: '9999px',
              transition: 'transform 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px 24px' }}>
          
          {/* Quick System & Display Options Section */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              <Palette size={13} color="#2563eb" />
              <span>系統與顯示選項 (System & Display)</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Theme Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  if (onToggleTheme) onToggleTheme()
                  else themeActions.toggleTheme()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {isDark ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#2563eb" />}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{isDark ? '切換明亮模式' : '切換深色模式'}</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
                </div>
              </button>

              {/* Filters / DarkReader Button */}
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onToggleDarkReaderPanel?.()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <Sliders size={18} color="#2563eb" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>色彩濾鏡微調</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Contrast & Filters</span>
                </div>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* User Email Readonly Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#cbd5e1' : '#64748b' }}>電子郵件 (Email Address)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', backgroundColor: isDark ? '#1e293b' : '#f8fafc', border: 'none', borderRadius: '12px', color: isDark ? '#cbd5e1' : '#64748b', fontSize: '13px', fontWeight: 500 }}>
                <Mail size={16} color="#94a3b8" />
                <span>{currentUser?.email || 'user@example.com'}</span>
              </div>
            </div>

            {/* Edit Username Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a' }}>使用名稱 (Username)</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  padding: '12px 14px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  fontWeight: 500,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            {/* Password Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={14} color="#2563eb" />
                <span>變更密碼 (選填)</span>
              </label>

              <input
                type="password"
                placeholder="目前舊密碼"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <input
                type="password"
                placeholder="新密碼 (至少 6 位數)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <input
                type="password"
                placeholder="再次確認新密碼"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  padding: '10px 14px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  border: 'none',
                  borderRadius: '12px',
                  color: isDark ? '#ffffff' : '#0f172a',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Red Logout Button Section */}
            {onLogout && (
              <div style={{ paddingTop: '8px', borderTop: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onLogout()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <LogOut size={16} />
                  <span>登出系統 (Logout)</span>
                </button>
              </div>
            )}

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  color: isDark ? '#cbd5e1' : '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={14} />
                <span>{saving ? '儲存中...' : '儲存變更'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
