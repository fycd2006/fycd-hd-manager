'use client'

import React, { useState, useEffect } from 'react'
import { X, Bell, Mail } from 'lucide-react'

export interface NotificationItem {
  id: number
  userId: number
  type: string
  title: string
  message: string
  data: string | null
  read: boolean
  createdAt: string
}

interface NotificationsModalProps {
  show: boolean
  onClose: () => void
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
  onRefreshWorkspaces?: () => void
}

export default function NotificationsModal({
  show,
  onClose,
  onToast,
  onRefreshWorkspaces
}: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (show) {
      fetchNotifications()
    }
  }, [show])

  if (!show) return null

  const handleAction = async (notificationId: number, action: 'accept' | 'decline') => {
    setProcessingId(notificationId)
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action })
      })
      const data = await res.json()
      if (res.ok) {
        onToast(data.message || (action === 'accept' ? '已成功加入工作區！' : '已拒絕邀請'), 'success')
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        if (action === 'accept' && onRefreshWorkspaces) {
          onRefreshWorkspaces()
        }
      } else {
        onToast(data.error || '處理失敗', 'error')
      }
    } catch {
      onToast('處理失敗，請稍後再試', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
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
          maxHeight: '80vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Borderless Clean Spacing */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 16px 24px',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              站內通知與邀請 {unreadCount > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#ef4444', color: '#fff', fontWeight: 800, marginLeft: '6px' }}>{unreadCount}</span>}
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

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px 24px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
              載入通知中...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Mail size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>目前沒有未讀的邀請或通知</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    borderRadius: '16px',
                    padding: '16px',
                    backgroundColor: n.read ? '#f8fafc' : '#eff6ff',
                    border: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                      {n.title}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    {n.message}
                  </p>

                  {n.type === 'workspace_invite' && !n.read && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleAction(n.id, 'decline')}
                        disabled={processingId === n.id}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        拒絕
                      </button>
                      <button
                        onClick={() => handleAction(n.id, 'accept')}
                        disabled={processingId === n.id}
                        style={{
                          padding: '7px 16px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(37,99,235,0.25)'
                        }}
                      >
                        {processingId === n.id ? '處理中...' : '接受邀請'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
