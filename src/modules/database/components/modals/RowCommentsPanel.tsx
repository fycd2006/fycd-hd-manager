'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, History, Send, Edit2, Check, X } from 'lucide-react'

export interface RowComment {
  id: number
  content: string
  createdAt: string
  user: {
    username: string
    role: string
  }
}

export type ActivityLogEntry = {
  id?: string
  content?: string
  user?: string
  time?: string
}

interface RowCommentsPanelProps {
  tableId: number
  rowId: number
  activityLog?: ActivityLogEntry[]
  onUpdateActivityLog?: (logs: ActivityLogEntry[]) => void
  readOnly?: boolean
}

export const RowCommentsPanel: React.FC<RowCommentsPanelProps> = ({
  tableId,
  rowId,
  activityLog = [],
  onUpdateActivityLog,
  readOnly = false,
}) => {
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')
  const [comments, setComments] = useState<RowComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingLogContent, setEditingLogContent] = useState('')

  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when comments update
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Fetch comments
  const loadComments = useCallback(async () => {
    if (!tableId || !rowId) return
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/rows/comments?rowId=${rowId}`)
      if (res.ok) {
        const data = await res.json()
        setComments(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Failed to load comments:', e)
    } finally {
      setCommentsLoading(false)
    }
  }, [tableId, rowId])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Post comment
  const postComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim() || readOnly) return

    try {
      const res = await fetch(`/api/tables/${tableId}/rows/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, content: commentInput.trim() }),
      })
      if (res.ok) {
        setCommentInput('')
        await loadComments()
      } else {
        const data = await res.json()
        alert(data.error || '留言失敗')
      }
    } catch {
      alert('留言發送失敗')
    }
  }

  // Handle Edit Activity Log
  const handleSaveLogEdit = (logId: string) => {
    if (!onUpdateActivityLog) return
    const updated = activityLog.map(item => {
      if (String(item.id) === String(logId)) {
        return { ...item, content: editingLogContent }
      }
      return item
    })
    onUpdateActivityLog(updated)
    setEditingLogId(null)
    setEditingLogContent('')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        borderLeft: '1px solid #e2e8f0',
        padding: '22px 20px',
        minWidth: 0,
      }}
    >
      {/* Tab Switcher (Segmented Pill) */}
      <div
        style={{
          display: 'flex',
          background: '#e2e8f0',
          padding: '4px',
          borderRadius: '14px',
          marginBottom: '18px',
          border: '1px solid rgba(203, 213, 225, 0.6)',
        }}
      >
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'comments' ? '#ffffff' : 'transparent',
            color: activeTab === 'comments' ? '#4f46e5' : '#64748b',
            boxShadow: activeTab === 'comments' ? '0 2px 8px rgba(15, 23, 42, 0.08)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="active:scale-[0.97]"
        >
          <MessageSquare size={15} />
          協作留言 ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'activity' ? '#ffffff' : 'transparent',
            color: activeTab === 'activity' ? '#4f46e5' : '#64748b',
            boxShadow: activeTab === 'activity' ? '0 2px 8px rgba(15, 23, 42, 0.08)' : 'none',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="active:scale-[0.97]"
        >
          <History size={15} />
          活動歷程 ({activityLog.length})
        </button>
      </div>

      {/* Tab Content 1: Comments */}
      {activeTab === 'comments' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              border: '1px solid rgba(226, 232, 240, 0.9)',
              borderRadius: '16px',
              padding: '16px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px',
              boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.03)',
            }}
          >
            {commentsLoading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '40px' }}>
                載入留言中...
              </div>
            ) : comments.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: '220px',
                  color: '#94a3b8',
                  gap: '12px',
                  padding: '24px',
                  textAlign: 'center',
                }}
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)' }}>
                  <MessageSquare size={24} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>尚無協作留言</span>
                <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '220px', lineHeight: '1.5' }}>
                  在下方輸入框輸入內容，與團隊成員開啟即時討論與備註！
                </span>
              </div>
            ) : (
              comments.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    background: '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                      {c.user?.username || '未知用戶'}{' '}
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#4f46e5', background: '#e0e7ff', padding: '1px 6px', borderRadius: '6px', marginLeft: '4px' }}>
                        {c.user?.role === 'admin' ? '管理員' : '成員'}
                      </span>
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155', wordBreak: 'break-word', lineHeight: '1.5' }}>
                    {c.content}
                  </p>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {!readOnly && (
            <form onSubmit={postComment} style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="輸入您的協作留言..."
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '13px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '14px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '12px 18px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.15s ease',
                }}
                className="active:scale-[0.96]"
              >
                <Send size={14} />
                傳送
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tab Content 2: Activity Log */}
      {activeTab === 'activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {activityLog.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: '200px',
                  color: '#94a3b8',
                  gap: '10px',
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  <History size={22} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>尚無變更歷程紀錄</span>
              </div>
            ) : (
              activityLog.map((log, index) => {
                const logId = log.id || String(index)
                const isEditing = editingLogId === logId
                const logUser = log.user || (log as any).username || '系統'
                const logTime = log.time || (log as any).timestamp || (log as any).createdAt || (log as any).date || ''
                const logContent = log.content || (log as any).description || (log as any).action || (log as any).message || (typeof log === 'string' ? log : '')

                return (
                  <div
                    key={logId}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#475569' }}>{logUser}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{logTime}</span>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <input
                          type="text"
                          value={editingLogContent}
                          onChange={e => setEditingLogContent(e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <button
                          onClick={() => handleSaveLogEdit(logId)}
                          style={{ padding: '2px 8px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <Check size={12} />
                          儲存
                        </button>
                        <button
                          onClick={() => setEditingLogId(null)}
                          style={{ padding: '2px 8px', background: '#94a3b8', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                        >
                          <X size={12} />
                          取消
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#334155' }}>{logContent}</span>
                        {!readOnly && onUpdateActivityLog && (
                          <button
                            onClick={() => {
                              setEditingLogId(logId)
                              setEditingLogContent(logContent)
                            }}
                            style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                          >
                            <Edit2 size={12} />
                            編輯
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {!readOnly && onUpdateActivityLog && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const input = (e.currentTarget.elements.namedItem('logInput') as HTMLInputElement)?.value
                if (!input || !input.trim()) return
                const nowStr = new Date().toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                const newLog = { id: `log_${Date.now()}`, content: input.trim(), user: '系統', time: nowStr }
                onUpdateActivityLog([...activityLog, newLog])
                e.currentTarget.reset()
              }}
              style={{ display: 'flex', gap: '8px', flexShrink: 0 }}
            >
              <input
                name="logInput"
                type="text"
                placeholder="手動新增變更/成全歷程..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 14px',
                  background: '#059669',
                  border: 'none',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                新增紀錄
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

export default RowCommentsPanel
