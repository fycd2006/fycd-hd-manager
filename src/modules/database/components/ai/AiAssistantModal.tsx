'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Send,
  Check,
  AlertTriangle,
  X,
  RotateCcw,
  Trash2,
  PlusCircle,
  Edit3,
  Loader2,
  Table,
  CheckCircle2,
  ChevronRight,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Zap,
} from 'lucide-react'
import { getSocketId } from '@/lib/pusher-client'
import type { DiffPreviewData } from './AiDiffModal'
import { useOptionalTableContext } from '@/modules/database/context/TableContext'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'

export interface AiAssistantModalProps {
  tableId: number | null
  isOpen: boolean
  onClose: () => void
  onApplySuccess?: () => void
  fetchTableData?: (tableId: number) => Promise<void>
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void
  selectedRowIds?: number[]
  isDocked?: boolean
  onToggleDock?: () => void
  isPanelExpanded?: boolean
  onToggleExpand?: () => void
  inlineSidebar?: boolean
  sidebarWidth?: number
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
function GeminiSparkleIcon({ size = 20, isSpinning = false }: { size?: number; isSpinning?: boolean }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={isSpinning ? { rotate: 360 } : { rotate: 0 }}
      transition={isSpinning ? { duration: 4, repeat: Infinity, ease: 'linear' } : undefined}
      style={{ overflow: 'visible', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="gemini-grad-modal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a73e8" />
          <stop offset="30%" stopColor="#8ab4f8" />
          <stop offset="70%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      <path
        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
        fill="url(#gemini-grad-modal)"
      />
    </motion.svg>
  )
}

export function AiAssistantModal({
  tableId,
  isOpen,
  onClose,
  onApplySuccess,
  fetchTableData,
  addToast = () => {},
  selectedRowIds = [],
  isDocked: propIsDocked,
  onToggleDock,
  isPanelExpanded: propIsExpanded,
  onToggleExpand,
  inlineSidebar = false,
  sidebarWidth,
}: AiAssistantModalProps) {
  const tableCtx = useOptionalTableContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingMessageId, setApplyingMessageId] = useState<string | null>(null)

  const [internalIsExpanded, setInternalIsExpanded] = useState(false)
  const isPanelExpanded = propIsExpanded !== undefined ? propIsExpanded : internalIsExpanded
  const handleToggleExpand = onToggleExpand || (() => setInternalIsExpanded(prev => !prev))

  const [internalIsDocked, setInternalIsDocked] = useState(true)
  const isDocked = propIsDocked !== undefined ? propIsDocked : internalIsDocked
  const handleToggleDock = onToggleDock || (() => setInternalIsDocked(prev => !prev))

  const [clearSelectionFocus, setClearSelectionFocus] = useState(false)

  // Active selected rows priority: prop selectedRowIds -> tableCtx.selectedRow
  const activeSelectedRowIds: number[] = React.useMemo(() => {
    if (clearSelectionFocus) return []
    if (selectedRowIds && selectedRowIds.length > 0) return selectedRowIds
    if (tableCtx?.selectedRow?.id) return [tableCtx.selectedRow.id]
    return []
  }, [clearSelectionFocus, selectedRowIds, tableCtx?.selectedRow?.id])

  // If a new row is selected in the table, re-enable focus
  const prevSelectedRowIdRef = useRef<number | null | undefined>(tableCtx?.selectedRow?.id)
  useEffect(() => {
    if (tableCtx?.selectedRow?.id !== prevSelectedRowIdRef.current) {
      prevSelectedRowIdRef.current = tableCtx?.selectedRow?.id
      setClearSelectionFocus(false)
    }
  }, [tableCtx?.selectedRow?.id])

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
          context: {
            selectedRowIds: activeSelectedRowIds.length > 0 ? activeSelectedRowIds : undefined,
            activeViewName: tableCtx?.views?.find(v => v.id === tableCtx?.activeViewId)?.name || (tableCtx?.currentView ? String(tableCtx.currentView) : undefined),
          },
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
            content: `已成功執行變更：${diff.reason || summary}`,
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

  // Content of the AI drawer/sidebar
  const drawerBody = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid #edf2f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <GeminiSparkleIcon size={18} isSpinning={loading} />
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
              <span
                style={{
                  fontSize: '10.5px',
                  color: '#94a3b8',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  fontWeight: 500,
                }}
              >
                2.0 Flash
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {/* Dock / Pin Toggle Button */}
          <button
            type="button"
            onClick={handleToggleDock}
            title={isDocked ? '切換為浮動遮罩對話框' : '釘選為右側邊欄 (邊看表邊對話，不遮蔽表格)'}
            style={{
              background: isDocked ? '#f0fdf4' : '#f8fafc',
              border: isDocked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '5px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: isDocked ? '#166534' : '#475569',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            {isDocked ? <Pin size={12} /> : <PinOff size={12} />}
            <span>{isDocked ? '已釘選側欄' : '浮動'}</span>
          </button>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            title="開啟新對話 (重置上下文)"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '5px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#475569',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={12} />
            <span>新對話</span>
          </button>

          {/* Expand / Narrow Width toggle */}
          <button
            type="button"
            onClick={handleToggleExpand}
            title={isPanelExpanded ? '縮小側欄 (460px)' : '加寬側欄 (620px)'}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#64748b',
              padding: '5px 7px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPanelExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
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
              padding: '5px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Message Stream Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
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
              padding: '24px 8px',
              textAlign: 'center',
              gap: '14px',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)',
                border: '1px solid #e0e7ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.12)',
              }}
            >
              <GeminiSparkleIcon size={28} />
            </motion.div>

            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                今天想如何調整資料表？
              </h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5, maxWidth: '340px' }}>
                Gemini 可以協助批次修改儲存格、自動補齊、填寫留言紀錄或快速統計。
              </p>
            </div>

            {/* Quick Inspiration Chips */}
            <div style={{ width: '100%', marginTop: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textAlign: 'left', marginBottom: '8px', paddingLeft: '4px' }}>
                常用範例提示詞：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {PRESET_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    whileHover={{ y: -1.5, scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSendMessage(prompt)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '12.5px',
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <span>{prompt}</span>
                    <ChevronRight size={13} color="#94a3b8" />
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Message List */}
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '4px',
            }}
          >
            {/* Author label & timestamp */}
            <div style={{ fontSize: '11px', color: '#94a3b8', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {msg.role === 'model' && <GeminiSparkleIcon size={12} />}
              <span>{msg.role === 'user' ? '您' : 'Gemini'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
            </div>

            {/* Bubble Content */}
            <div
              style={{
                maxWidth: '92%',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '10px 14px',
                fontSize: '13.5px',
                lineHeight: 1.5,
                backgroundColor: msg.role === 'user' ? '#1e293b' : '#f8fafc',
                color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                boxShadow: msg.role === 'user' ? '0 2px 6px rgba(15,23,42,0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              {msg.error ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444' }}>
                  <AlertTriangle size={15} />
                  <span>{msg.content}</span>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
              )}

              {/* Diff Preview Card (Double-Bezel Architecture) */}
              {msg.diff && (
                <div
                  style={{
                    marginTop: '10px',
                    borderRadius: '12px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      borderRadius: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>
                        變更規劃：{msg.diff.reason || '批次調整'}
                      </span>
                      {msg.applied ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                          <CheckCircle2 size={13} />
                          已套用
                        </span>
                      ) : (
                        <span style={{ color: '#6366f1', fontWeight: 600 }}>
                          待確認
                        </span>
                      )}
                    </div>

                    {/* Change Diff Table */}
                    {msg.diff.changes && msg.diff.changes.length > 0 && (
                      <div style={{ overflowX: 'auto', maxHeight: '220px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '6px 8px' }}>目標列</th>
                              <th style={{ padding: '6px 8px' }}>欄位</th>
                              <th style={{ padding: '6px 8px' }}>原數值</th>
                              <th style={{ padding: '6px 8px' }}>變更後</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.diff.changes.map((c, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '6px 8px', color: '#475569' }}>{c.rowTitle || `#${c.rowId}`}</td>
                                <td style={{ padding: '6px 8px', color: '#64748b' }}>{c.fieldName}</td>
                                <td style={{ padding: '6px 8px', color: '#94a3b8', textDecoration: 'line-through' }}>{c.oldValue}</td>
                                <td style={{ padding: '6px 8px', color: '#16a34a', fontWeight: 600 }}>{c.newValue}</td>
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
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '11.5px',
                          color: '#991b1b',
                        }}
                      >
                        <div>
                          即將刪除以下 <strong style={{ color: '#dc2626' }}><SlidingNumber number={msg.diff.deletedRows.length} /></strong> 筆資料：
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                          {msg.diff.deletedRows.map((r, i) => (
                            <span key={i} style={{ backgroundColor: '#ffffff', border: '1px solid #f87171', padding: '1px 5px', borderRadius: '4px' }}>
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
                          borderRadius: '6px',
                          padding: '8px 10px',
                          fontSize: '11.5px',
                          color: '#166534',
                        }}
                      >
                        <div>
                          預計新增 <strong style={{ color: '#15803d' }}><SlidingNumber number={msg.diff.newRows.length} /></strong> 筆資料
                        </div>
                      </div>
                    )}

                    {/* Apply Button */}
                    {!msg.applied && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          預計修改 <span style={{ fontWeight: 700, color: '#3b82f6' }}><SlidingNumber number={msg.diff.changes?.length || 0} /></span> 個儲存格
                        </div>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleApplyDiff(msg.id, msg.diff!)}
                          disabled={applyingMessageId === msg.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: applyingMessageId === msg.id ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {applyingMessageId === msg.id ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>套用中...</span>
                            </>
                          ) : (
                            <>
                              <Check size={13} />
                              <span>確認套用變更</span>
                            </>
                          )}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Gemini Thinking / Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
              <GeminiSparkleIcon size={14} isSpinning={true} />
              <span>Gemini</span>
            </div>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '16px 16px 16px 4px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#64748b',
                fontSize: '13px',
              }}
            >
              <Loader2 size={14} className="animate-spin" style={{ color: '#6366f1' }} />
              <span>Gemini 正在分析表格結構與指令...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Gemini Pill Input Bar (Double-Bezel Architecture) */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        {/* Active Selection Context Pill with SlidingNumber */}
        {activeSelectedRowIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 10px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              fontSize: '11.5px',
              color: '#166534',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={13} color="#16a34a" />
              <span>
                <strong>已鎖定選取範圍：</strong>
                共 <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}><SlidingNumber number={activeSelectedRowIds.length} /></span> 筆選取列
                {activeSelectedRowIds.length === 1 ? ` (#${activeSelectedRowIds[0]})` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setClearSelectionFocus(true)}
              title="取消限定，對全表操作"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#15803d',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '11px',
              }}
            >
              <span>取消鎖定</span>
              <X size={11} />
            </button>
          </motion.div>
        )}

        {/* Input Bar */}
        <div
          style={{
            position: 'relative',
            borderRadius: '20px',
            border: '1.5px solid #cbd5e1',
            backgroundColor: '#ffffff',
            padding: '5px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
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
              maxHeight: '90px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '13px',
              lineHeight: 1.4,
              color: '#1e293b',
              backgroundColor: 'transparent',
              paddingTop: '6px',
              paddingBottom: '6px',
            }}
          />

          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage()}
            disabled={loading || !inputValue.trim()}
            style={{
              width: '30px',
              height: '30px',
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
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
          </motion.button>
        </div>

        <div
          style={{
            fontSize: '10.5px',
            color: '#94a3b8',
            textAlign: 'center',
          }}
        >
          Gemini 可能會產生不準確的資訊，重大變更請透過預覽卡片確認後再套用。
        </div>
      </div>
    </div>
  )

  // 1. INLINE SIDEBAR MODE: Render directly in workspace beside data table
  if (inlineSidebar) {
    return (
      <aside
        className="ai-assistant-sidebar"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: `${sidebarWidth || (isPanelExpanded ? 620 : 460)}px`,
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          boxShadow: '-4px 0 20px rgba(15, 23, 42, 0.05)',
          transition: 'width 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {drawerBody}
      </aside>
    )
  }

  // 2. MODAL / FLOATING MODE: Render via portal with backdrop
  const modalContent = (
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
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        style={{
          width: isPanelExpanded ? '620px' : '460px',
          maxWidth: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.18)',
          borderLeft: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {drawerBody}
      </motion.div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null
}
