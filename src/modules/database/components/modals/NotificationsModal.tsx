'use client'

import React, { useState, useEffect } from 'react'
import { X, Bell, CheckCircle, XCircle, Mail, ShieldAlert } from 'lucide-react'

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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)' }}>
      <div style={{ width: '500px', maxHeight: '80vh', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 50px rgba(0,0,0,0.22)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={20} color="#2563eb" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              站內通知與邀請 {unreadCount > 0 && <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#ef4444', color: '#fff', fontWeight: 700, marginLeft: '6px' }}>{unreadCount}</span>}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
              載入通知中...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Mail size={36} color="#cbd5e1" style={{ marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>目前沒有未讀的邀請或通知</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifications.map((n) => {
                const inviteData = n.data ? JSON.parse(n.data) : null

                return (
                  <div key={n.id} style={{ border: n.read ? '1px solid #f1f5f9' : '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', backgroundColor: n.read ? '#fafafa' : '#eff6ff', transition: 'all 0.15s ease' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        {n.title}
                      </h4>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 14px 0', lineHeight: 1.5 }}>
                      {n.message}
                    </p>

                    {n.type === 'workspace_invite' && !n.read && (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleAction(n.id, 'decline')}
                          disabled={processingId === n.id}
                          style={{ padding: '7px 14px', backgroundColor: '#ffffff', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          拒絕 (Decline)
                        </button>
                        <button
                          onClick={() => handleAction(n.id, 'accept')}
                          disabled={processingId === n.id}
                          style={{ padding: '7px 16px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' }}
                        >
                          {processingId === n.id ? '處理中...' : '接受邀請 (Accept)'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
