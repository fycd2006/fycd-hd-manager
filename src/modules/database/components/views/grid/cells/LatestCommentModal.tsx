import React, { useState } from 'react';
import { MessageSquare, X, Edit2, Trash2, Check, Send } from 'lucide-react';
import ModalOverlay from '@/components/ui/ModalOverlay';

export interface CommentLogEntry {
  id: string
  user: string
  time: string
  content: string
}

export const parseLatestCommentEntries = (val: any): CommentLogEntry[] => {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

export const LatestCommentModal: React.FC<{
  show: boolean
  value: any
  fieldName?: string
  onChange: (newValue: CommentLogEntry[]) => void
  onClose: () => void
  readOnly?: boolean
}> = ({ show, value, fieldName = '最新留言紀錄', onChange, onClose, readOnly = false }) => {
  const entries = parseLatestCommentEntries(value)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const handleAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!newText.trim() || readOnly) return
    const nowStr = new Date().toLocaleString('zh-TW', { hour12: false })
    const newEntry: CommentLogEntry = {
      id: 'lc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: '使用者',
      time: nowStr,
      content: newText.trim()
    }
    const updated = [...entries, newEntry]
    onChange(updated)
    setNewText('')
  }

  const handleSaveEdit = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!editText.trim() || readOnly) return
    const updated = entries.map(item => item.id === id ? { ...item, content: editText.trim() } : item)
    onChange(updated)
    setEditingId(null)
    setEditText('')
  }

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (readOnly) return
    const updated = entries.filter(item => item.id !== id)
    onChange(updated)
  }

  return (
    <ModalOverlay
      show={show}
      onClose={onClose}
      className="animate-in fade-in duration-150"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <div
        className="animate-in zoom-in-95 duration-150"
        style={{
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '88vh',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FFF7ED', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EA580C' }}>
              <MessageSquare size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{fieldName}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>檢視所有歷史備註留言與新增修訂紀錄</p>
            </div>
            <span style={{ fontSize: '11px', background: '#FFEDD5', color: '#C2410C', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, marginLeft: '6px' }}>
              {entries.length} 筆紀錄
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'background 0.15s ease' }}
            title="關閉"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scroll Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '160px', background: '#f8fafc' }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94a3b8', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={28} style={{ color: '#cbd5e1' }} />
              <span>尚無留言紀錄，請在下方輸入框新增第一筆備註。</span>
            </div>
          ) : (
            entries.map((item, idx) => {
              const isEditing = editingId === item.id
              const isLatest = idx === entries.length - 1
              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isLatest ? '#FFF7ED' : '#ffffff',
                    border: isLatest ? '1px solid #FED7AA' : '1px solid #e2e8f0',
                    boxShadow: isLatest ? '0 2px 8px rgba(234, 88, 12, 0.06)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{item.user}</span>
                      {isLatest && (
                        <span style={{ fontSize: '10px', background: '#EA580C', color: '#ffffff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          最新紀錄
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.time}</span>
                      {!readOnly && !isEditing && (
                        <button
                          type="button"
                          onClick={() => { setEditingId(item.id); setEditText(item.content); }}
                          title="更正此筆紀錄"
                          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#475569', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                        >
                          <Edit2 size={12} /> 更正
                        </button>
                      )}
                      {!readOnly && !isEditing && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          title="刪除此筆紀錄"
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', padding: '3px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
                        >
                          <Trash2 size={12} /> 刪除
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <textarea
                        rows={3}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '13px',
                          border: '1.5px solid #EA580C',
                          borderRadius: '6px',
                          resize: 'vertical',
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(234, 88, 12, 0.12)',
                          lineHeight: '1.6',
                          background: '#ffffff'
                        }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={(e) => handleSaveEdit(item.id, e)}
                          style={{ background: '#EA580C', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> 儲存更正
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#334155', wordBreak: 'break-word', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                      {item.content}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Modal Footer: New Comment Input */}
        {!readOnly && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea
              rows={3}
              placeholder="輸入新留言備註 (長文字，支援多列輸入)..."
              value={newText}
              onChange={e => setNewText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                resize: 'vertical',
                minHeight: '64px',
                background: '#ffffff',
                lineHeight: '1.6'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={(e) => handleAdd(e)}
                disabled={!newText.trim()}
                style={{
                  background: newText.trim() ? '#EA580C' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: newText.trim() ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: newText.trim() ? '0 2px 4px rgba(234, 88, 12, 0.2)' : 'none'
                }}
              >
                <Send size={14} />
                <span>新增留言</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
