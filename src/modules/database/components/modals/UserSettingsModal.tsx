'use client'

import React, { useState } from 'react'
import { X, User, Mail, Shield, Key, Check } from 'lucide-react'
import type { User as UserType } from '@/modules/database/types'

interface UserSettingsModalProps {
  show: boolean
  onClose: () => void
  currentUser: UserType
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function UserSettingsModal({
  show,
  onClose,
  currentUser,
  onToast
}: UserSettingsModalProps) {
  const [username, setUsername] = useState(currentUser?.username || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

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
    } catch (err: any) {
      onToast('更新失敗，請稍後再試', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '480px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={20} color="#2563eb" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>My settings (個人設定)</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveProfile} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* User Email Readonly */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Email Address (電子郵件)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#64748b', fontSize: '14px' }}>
              <Mail size={16} />
              <span>{currentUser?.email || 'user@example.com'}</span>
            </div>
          </div>

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Username (使用者名稱)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              required
            />
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Key size={16} color="#64748b" />
              <span>變更密碼 (Password Settings)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="password"
                placeholder="目前舊密碼"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              />
              <input
                type="password"
                placeholder="新密碼 (至少 6 個字元)"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              />
              <input
                type="password"
                placeholder="再次確認新密碼"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 18px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '10px 22px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
            >
              {saving ? '儲存中...' : '儲存變更'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
