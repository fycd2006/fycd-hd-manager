'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles,
  Send,
  Check,
  AlertTriangle,
  X,
  ArrowRight,
  Loader2,
  Bot,
  Lightbulb,
  RotateCcw,
  CheckCircle2,
  Trash2,
  PlusCircle,
  Edit3
} from 'lucide-react'
import { getSocketId } from '@/lib/pusher-client'
import type { DiffPreviewData } from './AiDiffModal'

export interface AiAssistantModalProps {
  tableId: number | null
  isOpen: boolean
  onClose: () => void
  onApplySuccess?: () => void
  fetchTableData?: (tableId: number) => Promise<void>
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void
}

const PRESET_PROMPTS = [
  '將所有尚未填寫組別的列設為「建興組」',
  '檢查並列出電話號碼格式不正確的列',
  '新增一筆姓名為「新成員」、組別為「大安組」的資料',
  '刪除狀態為「已結案」的資料列',
]

export function AiAssistantModal({
  tableId,
  isOpen,
  onClose,
  onApplySuccess,
  fetchTableData,
  addToast = () => {},
}: AiAssistantModalProps) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [diffData, setDiffData] = useState<DiffPreviewData | null>(null)
  const [textReply, setTextReply] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setDiffData(null)
      setTextReply(null)
      setSuccessMessage(null)
      setErrorMessage(null)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleAnalyze = async (overridePrompt?: string) => {
    const query = (overridePrompt || prompt).trim()
    if (!query || !tableId) {
      if (!tableId) setErrorMessage('尚未選取有效資料表')
      return
    }

    setLoading(true)
    setErrorMessage(null)
    setTextReply(null)
    setDiffData(null)
    setSuccessMessage(null)

    try {
      const socketId = getSocketId()
      const res = await fetch('/api/ai/table-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(socketId ? { 'x-socket-id': socketId } : {}),
        },
        body: JSON.stringify({
          tableId,
          userPrompt: query,
          mode: 'dry_run',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'AI 請求失敗，請確認 API 金鑰與網路')
        setLoading(false)
        return
      }

      if (data.type === 'diff_preview') {
        setDiffData(data)
      } else if (data.type === 'text_reply') {
        setTextReply(data.message)
      } else {
        setTextReply(data.message || '分析完成，但未偵測到需要進行的資料表操作。')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '呼叫 AI 服務時發生錯誤')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyDiff = async () => {
    if (!diffData || !tableId) return
    setIsApplying(true)
    setErrorMessage(null)

    try {
      const socketId = getSocketId()
      const res = await fetch('/api/ai/table-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(socketId ? { 'x-socket-id': socketId } : {}),
        },
        body: JSON.stringify({
          tableId,
          mode: 'execute',
          confirmedAction: diffData.actionPayload,
          socketId,
        }),
      })

      const result = await res.json()
      if (res.ok) {
        const msg = result.summary || 'AI 變更已成功套用至資料庫！'
        setSuccessMessage(msg)
        addToast(msg, 'success')
        setDiffData(null)
        if (fetchTableData) await fetchTableData(tableId)
        if (onApplySuccess) onApplySuccess()
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setErrorMessage(result.error || '套用變更失敗')
        addToast(result.error || '套用變更失敗', 'error')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '套用變更時發生錯誤')
      addToast(err?.message || '套用變更失敗', 'error')
    } finally {
      setIsApplying(false)
    }
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999999,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !isApplying) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '88vh',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'aiModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #f8faff 0%, #f3f0ff 100%)',
            borderBottom: '1px solid #e9d5ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#1e1b4b' }}>
                  AI 資料表智慧助手
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    backgroundColor: '#ede9fe',
                    color: '#7c3aed',
                    border: '1px solid #ddd6fe',
                  }}
                >
                  Gemini Flash
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                透過自然語言自動查詢、批次更新、新增或刪除資料列
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading || isApplying}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="關閉 (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
          }}
        >
          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                color: '#b91c1c',
                fontSize: '13px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#15803d',
                fontSize: '13.5px',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* Text Reply from Gemini */}
          {textReply && (
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                gap: '12px',
              }}
            >
              <Bot size={20} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {textReply}
              </div>
            </div>
          )}

          {/* Diff Preview Confirmation View */}
          {diffData && (
            <div
              style={{
                backgroundColor: '#faf5ff',
                border: '1.5px solid #d8b4fe',
                borderRadius: '16px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {diffData.action === 'delete_rows' ? (
                    <Trash2 size={18} color="#ef4444" />
                  ) : diffData.action === 'create_rows' ? (
                    <PlusCircle size={18} color="#10b981" />
                  ) : (
                    <Edit3 size={18} color="#8b5cf6" />
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#581c87' }}>
                    變更預覽確認：{diffData.reason}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDiffData(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9333ea',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textDecoration: 'underline',
                  }}
                >
                  <RotateCcw size={13} />
                  重新修改
                </button>
              </div>

              {/* Updates List */}
              {diffData.action === 'update_cells' && diffData.changes && (
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid #e9d5ff',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f5f3ff', borderBottom: '1px solid #e9d5ff', color: '#6b21a8' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>資料列</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>目標欄位</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>修改前</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>修改後</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diffData.changes.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3e8ff' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>{c.rowTitle}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{c.fieldName}</td>
                          <td style={{ padding: '8px 12px', color: '#dc2626', textDecoration: 'line-through' }}>{c.oldValue}</td>
                          <td style={{ padding: '8px 12px', color: '#16a34a', fontWeight: 600 }}>{c.newValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Delete Rows Warning */}
              {diffData.action === 'delete_rows' && diffData.deletedRows && (
                <div
                  style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b', marginBottom: '6px' }}>
                    ⚠️ 即將刪除以下 {diffData.deletedRows.length} 筆資料：
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {diffData.deletedRows.map((r, i) => (
                      <span
                        key={i}
                        style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #f87171',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '12px',
                          color: '#b91c1c',
                          fontWeight: 500,
                        }}
                      >
                        {r.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Create Rows Preview */}
              {diffData.action === 'create_rows' && diffData.newRows && (
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    padding: '10px 14px',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>
                    新增 {diffData.newRows.length} 筆資料預覽：
                  </div>
                  <pre style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
                    {JSON.stringify(diffData.newRows, null, 2)}
                  </pre>
                </div>
              )}

              {/* Action Buttons inside Diff Card */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setDiffData(null)}
                  disabled={isApplying}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleApplyDiff}
                  disabled={isApplying}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isApplying ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  {isApplying ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>正在寫入資料庫...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>確認套用變更</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Main Prompt Input Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              請輸入您的指令：
            </label>
            <div
              style={{
                position: 'relative',
                borderRadius: '14px',
                border: '1.5px solid #c4b5fd',
                backgroundColor: '#ffffff',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.08)',
                overflow: 'hidden',
              }}
            >
              <textarea
                ref={inputRef}
                rows={3}
                placeholder="例如：「把所有未填寫組別的人改成建興組」、「新增一筆姓名為王小明、組別為大安組的列」..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading || isApplying}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAnalyze()
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  lineHeight: 1.5,
                  resize: 'none',
                  color: '#1e293b',
                  backgroundColor: 'transparent',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  borderTop: '1px solid #f1f5f9',
                  backgroundColor: '#f8fafc',
                }}
              >
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                  按 <kbd style={{ padding: '1px 4px', background: '#e2e8f0', borderRadius: '4px' }}>Enter</kbd> 送出，<kbd style={{ padding: '1px 4px', background: '#e2e8f0', borderRadius: '4px' }}>Shift + Enter</kbd> 換行
                </span>

                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={loading || isApplying || !prompt.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || !prompt.trim() ? 0.6 : 1,
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Gemini 分析中...</span>
                    </>
                  ) : (
                    <>
                      <span>送出分析</span>
                      <Send size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Prompts Suggestions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#6d28d9', fontWeight: 600 }}>
              <Lightbulb size={14} />
              <span>點擊快速帶入範本：</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(p)
                    handleAnalyze(p)
                  }}
                  disabled={loading || isApplying}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#6b21a8',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ede9fe')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f5f3ff')}
                >
                  <span>{p}</span>
                  <ArrowRight size={12} style={{ opacity: 0.6 }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <span>💡 提示：所有 AI 操作均會經由您預覽確認後才寫入資料庫，安全有保障。</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '12.5px',
            }}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
