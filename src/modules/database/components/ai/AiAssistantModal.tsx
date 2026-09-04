'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sparkles,
  Send,
  Check,
  AlertTriangle,
  X,
  RotateCcw,
  Trash2,
  PlusCircle,
  Edit3,
  Loader2,
  Plus,
  Table,
  CheckCircle2,
  ChevronRight
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

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  diff?: DiffPreviewData | null
  applied?: boolean
  error?: string | null
  timestamp: string
}

const PRESET_PROMPTS = [
  '將所有尚未填寫組別的列設為「建興組」',
  '找出並列出電話號碼格式有誤的列',
  '新增一筆姓名為「新成員」、組別為「大安組」的資料',
  '刪除狀態為「已結案」的資料列',
  '統計這張表格目前的總人數與各組別分佈',
]

// Gemini 4-pointed Sparkle SVG icon with official Google gradient
function GeminiSparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gemini-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a73e8" />
          <stop offset="30%" stopColor="#8ab4f8" />
          <stop offset="70%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  )
}

export function AiAssistantModal({
  tableId,
  isOpen,
  onClose,
  onApplySuccess,
  fetchTableData,
  addToast = () => {},
}: AiAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null)
  const [isPanelExpanded, setIsPanelExpanded] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen])

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // ESC key to close
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

  // Reset conversation to initial state
  const handleNewChat = () => {
    setMessages([])
    setInputValue('')
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputValue).trim()
    if (!textToSend || loading || !tableId) {
      if (!tableId) addToast('尚未選取有效資料表', 'error')
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    const updatedHistory = [...messages, userMessage]
    setMessages(updatedHistory)
    setInputValue('')
    setLoading(true)

    try {
      const socketId = getSocketId()
      // Send previous messages as context to Gemini for multi-turn reasoning
      const res = await fetch('/api/ai/table-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(socketId ? { 'x-socket-id': socketId } : {}),
        },
        body: JSON.stringify({
          tableId,
          userPrompt: textToSend,
          messages: updatedHistory.map(m => ({ role: m.role, content: m.content })),
          mode: 'dry_run',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errorText = data.error || 'AI 處理失敗，請稍候再試。'
        setMessages(prev => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            content: errorText,
            error: errorText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
        return
      }

      if (data.type === 'diff_preview') {
        setMessages(prev => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            content: data.aiMessage || data.reason || '已為您規劃以下變更，請檢查並確認是否套用：',
            diff: data,
            applied: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            content: data.message || '完成指令分析。',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          content: err?.message || '呼叫 Gemini 時發生連線問題，請稍候再試。',
          error: err?.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleApplyDiff = async (messageId: string, diff: DiffPreviewData) => {
    if (!tableId || !diff.actionPayload) return
    setApplyingMessageId(messageId)

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
          confirmedAction: diff.actionPayload,
          socketId,
        }),
      })

      const result = await res.json()

      if (res.ok) {
        const summary = result.summary || '變更已成功套用至資料庫！'
        addToast(summary, 'success')

        // Mark message as applied
        setMessages(prev =>
          prev.map(m => (m.id === messageId ? { ...m, applied: true } : m))
        )

        // Append confirmation in conversation
        setMessages(prev => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'model',
            content: `✅ ${summary} 您可以繼續提出其他調整需求。`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])

        if (fetchTableData) await fetchTableData(tableId)
        if (onApplySuccess) onApplySuccess()
      } else {
        addToast(result.error || '套用變更失敗', 'error')
      }
    } catch (err: any) {
      addToast(err?.message || '套用變更發生錯誤', 'error')
    } finally {
      setApplyingMessageId(null)
    }
  }

  const panelContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 99999999,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'all 0.2s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading && !applyingMessageId) onClose()
      }}
    >
      {/* Gemini Side Drawer / Panel */}
      <div
        style={{
          width: isPanelExpanded ? '640px' : '460px',
          maxWidth: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-6px 0 25px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: 'geminiPanelSlide 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gemini Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #edf2f7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <GeminiSparkleIcon size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                  Gemini
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
                    color: '#6366f1',
                    border: '1px solid #e0e7ff',
                  }}
                >
                  表格智慧助理
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* New Chat Button */}
            <button
              type="button"
              onClick={handleNewChat}
              title="開啟新對話 (重置上下文)"
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: '#475569',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            >
              <RotateCcw size={13} />
              <span>新對話</span>
            </button>

            {/* Expand / Narrow Width toggle */}
            <button
              type="button"
              onClick={() => setIsPanelExpanded(prev => !prev)}
              title={isPanelExpanded ? '縮小側欄' : '加寬側欄'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '6px',
                borderRadius: '8px',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{isPanelExpanded ? '⇤' : '⇥'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="關閉 (Esc)"
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
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Message Stream Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            background: '#ffffff',
          }}
        >
          {/* Welcome Screen when conversation is empty */}
          {messages.length === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '30px 10px',
                textAlign: 'center',
                gap: '14px',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
                  border: '1px solid #e0e7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',
                }}
              >
                <GeminiSparkleIcon size={32} />
              </div>

              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>
                  你好！我是 Gemini 資料表助理
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.6, maxWidth: '340px' }}>
                  你可以用自然語言向我詢問資料、要求批次修改、新增或刪除列。我具備連續對話記憶，能根據上下文逐步調整。
                </p>
              </div>

              {/* Suggestion Chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textAlign: 'left' }}>
                  建議提示詞（點擊立即嘗試）：
                </span>
                {PRESET_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      color: '#334155',
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9'
                      e.currentTarget.style.borderColor = '#c7d2fe'
                      e.currentTarget.style.color = '#4338ca'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                      e.currentTarget.style.color = '#334155'
                    }}
                  >
                    <span>{prompt}</span>
                    <ChevronRight size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: '6px',
              }}
            >
              {/* Message Header (Avatar / Label) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                {msg.role === 'model' && <GeminiSparkleIcon size={14} />}
                <span>{msg.role === 'user' ? '你' : 'Gemini'}</span>
                <span>• {msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: '92%',
                  padding: msg.role === 'user' ? '10px 16px' : '12px 16px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: msg.role === 'user' ? '#f1f5f9' : '#ffffff',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  color: '#1e293b',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  boxShadow: msg.role === 'user' ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {msg.content}

                {/* Embedded Diff Preview Card (Gemini Style) */}
                {msg.diff && (
                  <div
                    style={{
                      marginTop: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {msg.diff.action === 'delete_rows' ? (
                          <Trash2 size={16} color="#ef4444" />
                        ) : msg.diff.action === 'create_rows' ? (
                          <PlusCircle size={16} color="#10b981" />
                        ) : (
                          <Edit3 size={16} color="#6366f1" />
                        )}
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                          變更規劃：{msg.diff.reason}
                        </span>
                      </div>

                      {msg.applied && (
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '20px',
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={12} />
                          已套用
                        </span>
                      )}
                    </div>

                    {/* Cell Updates Table */}
                    {msg.diff.action === 'update_cells' && msg.diff.changes && (
                      <div
                        style={{
                          maxHeight: '180px',
                          overflowY: 'auto',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>列</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>欄位</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>舊值</th>
                              <th style={{ padding: '6px 10px', textAlign: 'left' }}>新值</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.diff.changes.map((c, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                <td style={{ padding: '6px 10px', fontWeight: 600 }}>{c.rowTitle}</td>
                                <td style={{ padding: '6px 10px', color: '#64748b' }}>{c.fieldName}</td>
                                <td style={{ padding: '6px 10px', color: '#dc2626', textDecoration: 'line-through' }}>{c.oldValue}</td>
                                <td style={{ padding: '6px 10px', color: '#16a34a', fontWeight: 600 }}>{c.newValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Delete Warning */}
                    {msg.diff.action === 'delete_rows' && msg.diff.deletedRows && (
                      <div
                        style={{
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: '#991b1b',
                        }}
                      >
                        <div>即將刪除以下 {msg.diff.deletedRows.length} 筆資料：</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                          {msg.diff.deletedRows.map((r, i) => (
                            <span key={i} style={{ backgroundColor: '#ffffff', border: '1px solid #f87171', padding: '1px 6px', borderRadius: '4px' }}>
                              {r.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Create Preview */}
                    {msg.diff.action === 'create_rows' && msg.diff.newRows && (
                      <div
                        style={{
                          backgroundColor: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '12px',
                          color: '#166534',
                        }}
                      >
                        <div>預計新增 {msg.diff.newRows.length} 筆資料</div>
                      </div>
                    )}

                    {/* Apply Button */}
                    {!msg.applied && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => handleApplyDiff(msg.id, msg.diff!)}
                          disabled={applyingMessageId === msg.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: applyingMessageId === msg.id ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {applyingMessageId === msg.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>套用中...</span>
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              <span>確認套用變更</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Gemini Thinking / Loading State */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                <GeminiSparkleIcon size={14} />
                <span>Gemini</span>
              </div>
              <div
                style={{
                  padding: '12px 18px',
                  borderRadius: '18px 18px 18px 4px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                <Loader2 size={16} className="animate-spin" style={{ color: '#6366f1' }} />
                <span>Gemini 正在分析表格與對話脈絡...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Gemini Pill Input Bar */}
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              position: 'relative',
              borderRadius: '24px',
              border: '1.5px solid #d1d5db',
              backgroundColor: '#ffffff',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              placeholder="向 Gemini 詢問或描述你想修改的資料..."
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              style={{
                width: '100%',
                maxHeight: '100px',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: '13.5px',
                lineHeight: 1.4,
                color: '#1e293b',
                backgroundColor: 'transparent',
                paddingTop: '6px',
                paddingBottom: '6px',
              }}
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={loading || !inputValue.trim()}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                background: inputValue.trim() && !loading
                  ? 'linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)'
                  : '#e2e8f0',
                color: inputValue.trim() && !loading ? '#ffffff' : '#94a3b8',
                cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              title="送出 (Enter)"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>

          <div
            style={{
              fontSize: '11px',
              color: '#94a3b8',
              textAlign: 'center',
            }}
          >
            Gemini 可能會產生不準確的資訊，重大變更請務必透過預覽卡片確認後再套用。
          </div>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(panelContent, document.body) : null
}
