'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { MessageSquare, History, Send, Edit2, Check, X } from 'lucide-react'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'

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

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  const [fetchedLogs, setFetchedLogs] = useState<ActivityLogEntry[]>([])

  const loadComments = useCallback(async () => {
    if (!tableId || !rowId) return
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/rows/comments?rowId=${rowId}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const userComments = data.filter((item: any) => !item.content.startsWith('[HISTORY]'))
          const historyLogs = data
            .filter((item: any) => item.content.startsWith('[HISTORY]'))
            .map((item: any) => ({
              id: String(item.id),
              user: item.user?.username || '系統 (System)',
              time: new Date(item.createdAt).toLocaleString('zh-TW', { hour12: false }),
              content: item.content.replace('[HISTORY] ', '')
            }))
          setComments(userComments)
          setFetchedLogs(historyLogs)
        }
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
        background: '#fcfcfc',
        borderLeft: '1px solid #e2e8f0',
        minWidth: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header Tabs with Animated Active Indicator */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          padding: '0 16px',
        }}
      >
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            position: 'relative',
            flex: 1,
            padding: '14px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'comments' ? 600 : 500,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: activeTab === 'comments' ? '#EA580C' : '#64748b',
            transition: 'color 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>Comments</span>
          {comments.length > 0 && (
            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>
              <SlidingNumber number={comments.length} />
            </span>
          )}
          {activeTab === 'comments' && (
            <motion.div
              layoutId="active-comment-tab-indicator"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#EA580C',
              }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          style={{
            position: 'relative',
            flex: 1,
            padding: '14px 16px',
            fontSize: '13px',
            fontWeight: activeTab === 'activity' ? 600 : 500,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: activeTab === 'activity' ? '#EA580C' : '#64748b',
            transition: 'color 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <span>History</span>
          {(activityLog.length + fetchedLogs.length) > 0 && (
            <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>
              <SlidingNumber number={activityLog.length + fetchedLogs.length} />
            </span>
          )}
          {activeTab === 'activity' && (
            <motion.div
              layoutId="active-comment-tab-indicator"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#EA580C',
              }}
              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            />
          )}
        </button>
      </div>

      {/* Tab Contents with AnimatePresence */}
      <AnimatePresence mode="wait">
        {activeTab === 'comments' && (
          <motion.div
            key="tab-comments"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '20px 20px 16px' }}
          >
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingRight: '4px',
              }}
            >
              {commentsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: '#94a3b8', fontSize: '13px' }}>
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '260px',
                    color: '#64748b',
                    gap: '16px',
                    padding: '32px 20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      border: '2px solid #1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1e293b',
                    }}
                  >
                    <MessageSquare size={28} strokeWidth={1.75} />
                  </div>
                  <div style={{ maxWidth: '260px' }}>
                    <p style={{ fontSize: '14px', color: '#334155', margin: 0, lineHeight: '1.5' }}>
                      No comments for this row yet. Use the form below to add a comment.
                    </p>
                  </div>
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      background: '#ffffff',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        {c.user?.username || 'User'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
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

            {/* Bottom Comment Input */}
            {!readOnly && (
              <form onSubmit={postComment} style={{ marginTop: '16px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Comment"
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 14px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      color: '#0f172a',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#EA580C')}
                    onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
                  />
                  <button
                    type="submit"
                    disabled={!commentInput.trim()}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      background: 'none',
                      border: 'none',
                      color: commentInput.trim() ? '#EA580C' : '#cbd5e1',
                      cursor: commentInput.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}

        {/* Tab Content 2: Activity Log */}
        {activeTab === 'activity' && (() => {
          const mergedLogs = [...activityLog, ...fetchedLogs]
          return (
            <motion.div
              key="tab-activity"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: '20px 20px 16px' }}
            >
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {mergedLogs.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      minHeight: '220px',
                      color: '#64748b',
                      gap: '12px',
                      padding: '24px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                      <History size={22} />
                    </div>
                    <span style={{ fontSize: '13px', color: '#475569' }}>尚無此資料列的歷史變更紀錄</span>
                  </div>
                ) : (
                  mergedLogs.map((log, index) => {
                    const logId = log.id || String(index)
                    const isEditing = editingLogId === logId
                    const logUser = log.user || (log as any).username || 'System'
                    const logTime = log.time || (log as any).timestamp || (log as any).createdAt || ''
                    const logContent = log.content || (log as any).description || (log as any).action || ''

                    return (
                      <div
                        key={logId}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, color: '#334155' }}>{logUser}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{logTime}</span>
                        </div>

                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                            <input
                              type="text"
                              value={editingLogContent}
                              onChange={(e) => setEditingLogContent(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            />
                            <button
                              onClick={() => handleSaveLogEdit(logId)}
                              style={{ padding: '4px 10px', background: '#18181B', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => setEditingLogId(null)}
                              style={{ padding: '4px 10px', background: '#94a3b8', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>{logContent}</span>
                            {!readOnly && onUpdateActivityLog && (
                              <button
                                onClick={() => {
                                  setEditingLogId(logId)
                                  setEditingLogContent(logContent)
                                }}
                                style={{ background: 'none', border: 'none', color: '#18181B', fontSize: '11px', cursor: 'pointer' }}
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}

export default RowCommentsPanel
