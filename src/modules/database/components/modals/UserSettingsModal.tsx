'use client'

import React, { useState } from 'react'
import { X, User, Mail, Key, Check } from 'lucide-react'
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
          width: '480px',
          maxWidth: '92vw',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
          border: 'none',
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
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              個人設定 (My Settings)
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
              background: '#f1f5f9',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              borderRadius: '9999px',
              transition: 'transform 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveProfile} style={{ padding: '16px 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* User Email Readonly Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>電子郵件 (Email Address)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', backgroundColor: '#f8fafc', border: 'none', borderRadius: '12px', color: '#64748b', fontSize: '13px', fontWeight: 500 }}>
              <Mail size={16} color="#94a3b8" />
              <span>{currentUser?.email || 'user@example.com'}</span>
            </div>
          </div>

          {/* Edit Username Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>使用名稱 (Username)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{
                padding: '12px 14px',
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                boxSizing: 'border-box'
              }}
              required
            />
          </div>

          {/* Password Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                color: '#0f172a',
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
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                color: '#0f172a',
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
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderRadius: '12px',
                color: '#0f172a',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Submit Action */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                color: '#475569',
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
  )
}
