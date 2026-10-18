import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MessageSquare, X, Pencil, Trash2, ArrowUp } from 'lucide-react';
import ModalOverlay from '@/components/ui/ModalOverlay';
import { useAuthStore } from '@/modules/database/store';
import {
  avatarColor,
  avatarInitial,
  formatCommentTime,
  formatRelativeTime,
  isContinuation,
  parseCommentTime,
} from './commentUtils';

export interface CommentLogEntry {
  id: string
  user: string
  time: string
  content: string
  editedAt?: string
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

const COMPOSER_MAX_HEIGHT = 160

const isSubmitKey = (e: React.KeyboardEvent) =>
  e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing

const autoGrow = (el: HTMLTextAreaElement | null) => {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`
}

const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 30 }) => (
  <span
    className="lc-avatar"
    aria-hidden="true"
    style={{ background: avatarColor(name), width: size, height: size, fontSize: size * 0.45 }}
  >
    {avatarInitial(name)}
  </span>
)

export const LatestCommentModal: React.FC<{
  show: boolean
  value: any
  fieldName?: string
  /** 從表格直接打字開啟時，帶入的第一個字 */
  initialText?: string
  onChange: (newValue: CommentLogEntry[]) => void
  onClose: () => void
  readOnly?: boolean
}> = ({ show, value, fieldName = '最新留言紀錄', initialText = '', onChange, onClose, readOnly = false }) => {
  const entries = parseLatestCommentEntries(value)
  const [newText, setNewText] = useState(initialText)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [draftWarning, setDraftWarning] = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)

  const [authState] = useAuthStore()
  const cachedUser = typeof window !== 'undefined' ? (() => {
    try {
      const raw = localStorage.getItem('fycd_cached_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })() : null
  const currentUserName = authState.currentUser?.username || cachedUser?.username || authState.currentUser?.email?.split('@')[0] || cachedUser?.email?.split('@')[0] || '使用者'
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  const submitHint = isMac ? '⌘ + Enter 送出' : 'Ctrl + Enter 送出'

  const focusComposer = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }

  useEffect(() => {
    if (show && !readOnly) {
      const timer = setTimeout(focusComposer, 50)
      return () => clearTimeout(timer)
    }
  }, [show, readOnly])

  useLayoutEffect(() => { autoGrow(textareaRef.current) }, [newText])
  useLayoutEffect(() => { autoGrow(editRef.current) }, [editText, editingId])

  useEffect(() => {
    if (!editingId) return
    const ta = editRef.current
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
  }, [editingId])

  // Esc／點遮罩／關閉鈕：依序收起刪除確認、取消更正、提醒草稿，最後才關閉
  const requestClose = () => {
    if (confirmDeleteId) { setConfirmDeleteId(null); return }
    if (editingId) { cancelEdit(); return }
    if (newText.trim() && !draftWarning) { setDraftWarning(true); focusComposer(); return }
    onClose()
  }

  const handleAdd = () => {
    if (!newText.trim() || readOnly) return
    const newEntry: CommentLogEntry = {
      id: 'lc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      user: currentUserName,
      time: formatCommentTime(new Date()),
      content: newText.trim()
    }
    onChange([...entries, newEntry])
    setJustAddedId(newEntry.id)
    setNewText('')
    setDraftWarning(false)
    focusComposer()
  }

  const startEdit = (item: CommentLogEntry) => {
    setConfirmDeleteId(null)
    setEditingId(item.id)
    setEditText(item.content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
    focusComposer()
  }

  const handleSaveEdit = (id: string) => {
    if (!editText.trim() || readOnly) return
    const original = entries.find(item => item.id === id)
    if (original && original.content !== editText.trim()) {
      onChange(entries.map(item => item.id === id
        ? { ...item, content: editText.trim(), editedAt: formatCommentTime(new Date()) }
        : item))
    }
    cancelEdit()
  }

  const handleDelete = (id: string) => {
    if (readOnly) return
    onChange(entries.filter(item => item.id !== id))
    setConfirmDeleteId(null)
    focusComposer()
  }

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitKey(e)) {
      e.preventDefault()
      handleAdd()
      return
    }
    if (e.key === 'ArrowUp' && !newText && !e.nativeEvent.isComposing) {
      const mine = [...entries].reverse().find(item => item.user === currentUserName)
      if (mine) {
        e.preventDefault()
        startEdit(mine)
      }
    }
  }

  const displayed = [...entries].reverse()

  return (
    <ModalOverlay show={show} onClose={requestClose} className="animate-in fade-in duration-150">
      <div className="lc-modal animate-in zoom-in-95 duration-150" role="dialog" aria-modal="true" aria-label={fieldName}>
        <header className="lc-header">
          <span className="lc-header-icon"><MessageSquare size={16} /></span>
          <div className="lc-header-text">
            <h3>{fieldName}</h3>
            <p>{entries.length > 0 ? `${entries.length} 則留言` : '尚無留言'}</p>
          </div>
          <button type="button" className="lc-icon-btn" onClick={requestClose} title="關閉 (Esc)" aria-label="關閉">
            <X size={18} />
          </button>
        </header>

        <ol className="lc-list">
          {displayed.length === 0 ? (
            <li className="lc-empty">
              <MessageSquare size={28} />
              <span>尚無留言紀錄{readOnly ? '' : '，在下方輸入第一則備註。'}</span>
            </li>
          ) : displayed.map((item, idx) => {
            const isEditing = editingId === item.id
            const isLatest = idx === 0
            const continued = isContinuation(item, displayed[idx - 1])
            const fullTime = parseCommentTime(item.time) ? item.time : undefined
            const classes = [
              'lc-entry',
              isLatest && 'lc-entry--latest',
              continued && 'lc-entry--continued',
              item.id === justAddedId && 'lc-entry--new',
            ].filter(Boolean).join(' ')
            return (
              <li key={item.id || idx} className={classes}>
                <div className="lc-gutter">{!continued && <Avatar name={item.user} />}</div>
                <div className="lc-main">
                  <div className="lc-meta">
                    {!continued && <span className="lc-author">{item.user}</span>}
                    <time className="lc-time" title={fullTime}>{formatRelativeTime(item.time)}</time>
                    {item.editedAt && <span className="lc-edited" title={`更正於 ${item.editedAt}`}>（已編輯）</span>}
                    {isLatest && <span className="lc-badge">最新紀錄</span>}
                    {!readOnly && !editingId && (
                      <div className="lc-actions">
                        <button type="button" className="lc-icon-btn" onClick={() => startEdit(item)} title="更正" aria-label="更正留言">
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="lc-icon-btn lc-icon-btn--danger" onClick={() => setConfirmDeleteId(item.id)} title="刪除" aria-label="刪除留言">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="lc-edit">
                      <textarea
                        ref={editRef}
                        aria-label="更正留言內容"
                        className="lc-textarea"
                        rows={2}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (isSubmitKey(e)) {
                            e.preventDefault()
                            handleSaveEdit(item.id)
                          }
                        }}
                      />
                      <div className="lc-edit-footer">
                        <span className="lc-hint">{isMac ? '⌘' : 'Ctrl'} + Enter 儲存 · Esc 取消</span>
                        <button type="button" className="lc-btn lc-btn--ghost" onClick={cancelEdit}>取消</button>
                        <button type="button" className="lc-btn lc-btn--primary" onClick={() => handleSaveEdit(item.id)} disabled={!editText.trim()}>
                          儲存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="lc-content">{item.content}</div>
                  )}

                  {confirmDeleteId === item.id && (
                    <div className="lc-confirm" role="alertdialog" aria-label="刪除這則留言？">
                      <div>
                        <strong>刪除這則留言？</strong>
                        <span>此動作無法復原</span>
                      </div>
                      <div className="lc-confirm-actions">
                        <button type="button" className="lc-btn lc-btn--ghost" autoFocus onClick={() => { setConfirmDeleteId(null); focusComposer() }}>取消</button>
                        <button type="button" className="lc-btn lc-btn--danger" onClick={() => handleDelete(item.id)}>刪除</button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {!readOnly && (
          <footer className="lc-composer">
            {draftWarning && (
              <div className="lc-draft-warning" role="status">
                還有未送出的留言，再按一次 Esc 或關閉即放棄
              </div>
            )}
            <div className="lc-composer-row">
              <Avatar name={currentUserName} size={30} />
              <div className="lc-composer-box">
                <textarea
                  ref={textareaRef}
                  className="lc-textarea lc-textarea--composer"
                  rows={1}
                  placeholder="輸入新留言備註…"
                  value={newText}
                  onChange={e => { setNewText(e.target.value); setDraftWarning(false) }}
                  onKeyDown={handleComposerKeyDown}
                />
                <button
                  type="button"
                  className="lc-send"
                  onClick={handleAdd}
                  disabled={!newText.trim()}
                  title={submitHint}
                >
                  <ArrowUp size={14} />
                  <span>新增留言</span>
                </button>
              </div>
            </div>
            <div className="lc-hint lc-composer-hint">
              {submitHint} · Enter 換行{entries.some(item => item.user === currentUserName) ? ' · ↑ 更正自己的上一則' : ''}
            </div>
          </footer>
        )}
      </div>
    </ModalOverlay>
  )
}
