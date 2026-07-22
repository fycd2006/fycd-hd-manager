'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

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
        background: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        padding: '16px',
        minWidth: 0,
      }}
    >
      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '8px',
          marginBottom: '12px',
        }}
      >
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'comments' ? '#6366f1' : 'transparent',
            color: activeTab === 'comments' ? '#fff' : '#64748b',
          }}
        >
          協作留言 ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'activity' ? '#6366f1' : 'transparent',
            color: activeTab === 'activity' ? '#fff' : '#64748b',
          }}
        >
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
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '12px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              marginBottom: '12px',
            }}
          >
            {commentsLoading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '20px' }}>
                載入留言中...
              </div>
            ) : comments.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '20px', fontStyle: 'italic' }}>
                尚無協作留言。在下方輸入內容開啟討論！
              </div>
            ) : (
              comments.map(c => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: '#f1f5f9',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                      {c.user?.username || '未知用戶'}{' '}
                      <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#64748b' }}>
                        ({c.user?.role === 'admin' ? '管理員' : '成員'})
                      </span>
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#334155', wordBreak: 'break-all', lineHeight: 1.4 }}>
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
                  background: '#6366f1',
                  border: 'none',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
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
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '20px', fontStyle: 'italic' }}>
                尚無歷史變更記錄。
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
                      padding: '8px 10px',
                      borderRadius: '6px',
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
                          style={{ padding: '2px 8px', background: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                        >
                          儲存
                        </button>
                        <button
                          onClick={() => setEditingLogId(null)}
                          style={{ padding: '2px 8px', background: '#94a3b8', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                        >
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
                            style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}
                          >
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
