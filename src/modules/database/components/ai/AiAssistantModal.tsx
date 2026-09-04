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
  Copy,
  ChevronDown,
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

export interface ChatMessageMeta {
  model?: string
  displayModel?: string
  isAuto?: boolean
  fallbackOccurred?: boolean
  latencyMs?: number
  tokens?: {
    prompt: number
    output: number
    total: number
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'model'
  content: string
  diff?: DiffPreviewData | null
  applied?: boolean
  error?: string | null
  timestamp: string
  actionBadge?: string
  meta?: ChatMessageMeta
}

export const MODEL_OPTIONS = [
  { id: 'auto', name: 'Auto (自動智能切換)', badge: '推薦', desc: '優先使用 3.6 Flash，尖峰繁忙自動平滑容錯切換' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', badge: '最新旗艦', desc: '新一代極速多模態模型，推理與工具精準度最高' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', badge: '穩定平衡', desc: '成熟穩定架構，高輸出吞吐能力' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', badge: '輕量極速', desc: '超輕量高吞吐，適合極簡資料分析' },
] as const

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
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const handleCopyContent = (msgId: string, content: string) => {
    if (!content) return
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(content).then(() => {
        setCopiedMessageId(msgId)
        setTimeout(() => {
          setCopiedMessageId((prev) => (prev === msgId ? null : prev))
        }, 2000)
      }).catch(() => {})
    }
  }

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
          requestedModel: selectedModel,
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
        const actionBadge = data.action === 'update_cells'
          ? `update_cells (${data.changes?.length || 0} 筆儲存格)`
          : data.action === 'create_rows'
          ? `create_rows (${data.newRows?.length || 0} 列)`
          : data.action === 'delete_rows'
          ? `delete_rows (${data.deletedRows?.length || 0} 列)`
          : `run_diff: ${data.action || 'plan'}`

        setMessages(prev => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            content: data.aiMessage || data.reason || '已為您規劃以下變更，請檢查並確認是否套用：',
            diff: data,
            applied: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionBadge,
            meta: data.meta,
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
            actionBadge: data.actionPayload ? `$ ${data.actionPayload.name}` : undefined,
            meta: data.meta,
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
      {/* Top Header (Aligned with 52px Toolbar, Gemini minimal style) */}
      <div
        style={{
          height: '52px',
          minHeight: '52px',
          maxHeight: '52px',
          padding: '0 12px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <GeminiSparkleIcon size={18} isSpinning={loading} />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.2px' }}>
            Gemini
          </span>

          {/* Model Switcher Pill */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(prev => !prev)}
              title="切換 AI 模型（預設支援自動智能切換與備援）"
              aria-label="切換 AI 模型"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                borderRadius: '12px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                fontSize: '11px',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9' }}
            >
              <span>
                {selectedModel === 'auto'
                  ? 'Auto'
                  : selectedModel === 'gemini-3.6-flash'
                  ? '3.6 Flash'
                  : selectedModel === 'gemini-3.5-flash'
                  ? '3.5 Flash'
                  : '3.1 Lite'}
              </span>
              <ChevronDown size={11} color="#64748b" />
            </button>

            <AnimatePresence>
              {isModelDropdownOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    onClick={() => setIsModelDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '240px',
                      backgroundColor: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 10px 25px -4px rgba(15, 23, 42, 0.15), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
                      padding: '5px',
                      zIndex: 95,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ padding: '4px 8px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      模型架構選擇
                    </div>
                    {MODEL_OPTIONS.map((opt) => {
                      const isSelected = selectedModel === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(opt.id)
                            setIsModelDropdownOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '2px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background-color 0.1s',
                            width: '100%',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc'
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#0f172a' : '#334155' }}>
                              {opt.name}
                            </span>
                            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9', color: isSelected ? '#1d4ed8' : '#64748b' }}>
                              {opt.badge}
                            </span>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                            {opt.desc}
                          </div>
                        </button>
                      )
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleNewChat}
            title="新對話"
            aria-label="新對話"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <RotateCcw size={15} />
          </button>

          {/* Dock / Pin Toggle Button */}
          <button
            type="button"
            onClick={handleToggleDock}
            title={isDocked ? '已釘選側欄' : '浮動'}
            aria-label={isDocked ? '已釘選側欄' : '浮動'}
            style={{
              background: isDocked ? '#f0fdf4' : 'transparent',
              border: isDocked ? '1px solid #bbf7d0' : 'none',
              borderRadius: '6px',
              width: '30px',
              height: '30px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDocked ? '#16a34a' : '#64748b',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!isDocked) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }
            }}
            onMouseLeave={(e) => {
              if (!isDocked) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }
            }}
          >
            {isDocked ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          {/* Expand / Narrow Width toggle */}
          <button
            type="button"
            onClick={handleToggleExpand}
            title={isPanelExpanded ? '縮小側欄 (360px)' : '加寬側欄 (460px)'}
            aria-label={isPanelExpanded ? '縮小側欄' : '加寬側欄'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            {isPanelExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title="關閉側邊欄 (Esc)"
            aria-label="關閉側邊欄"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              width: '30px',
              height: '30px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
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
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                今天想如何調整資料表？
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748b', lineHeight: 1.4, maxWidth: '300px' }}>
                Gemini 可以協助批次修改儲存格、自動補齊、填寫留言紀錄或快速統計。
              </p>
            </div>

            <div style={{ width: '100%', marginTop: '2px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px', textAlign: 'left' }}>
                常用範例提示詞：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {PRESET_PROMPTS.map((prompt, idx) => (
                  <motion.button
                    key={idx}
                    type="button"
                    whileHover={{ y: -1, scale: 1.005 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSendMessage(prompt)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '6px 10px',
                      textAlign: 'left',
                      fontSize: '11.5px',
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
                    <ChevronRight size={12} color="#94a3b8" />
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

            {/* Bubble Container with Hover Telemetry Card */}
            <div
              onMouseEnter={() => msg.role === 'model' && setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              style={{
                position: 'relative',
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
              {/* Floating Dark Hover Telemetry Card (Shown when hovering over response content) */}
              <AnimatePresence>
                {hoveredMessageId === msg.id && msg.role === 'model' && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: 0,
                      zIndex: 40,
                      width: '280px',
                      maxWidth: '90vw',
                      backgroundColor: '#0f172a',
                      color: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      padding: '10px 12px',
                      boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.4)',
                      fontSize: '11px',
                      lineHeight: 1.5,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: '#38bdf8' }}>
                        <Zap size={12} />
                        <span>執行指標與模型資訊</span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: '#1e293b', padding: '1px 5px', borderRadius: '4px' }}>
                        {msg.meta?.isAuto ? '智能模式' : '指定模式'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px 8px', fontSize: '11px' }}>
                      <span style={{ color: '#94a3b8' }}>使用模型:</span>
                      <span style={{ color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>
                        {msg.meta?.model || 'gemini-3.6-flash'}
                      </span>

                      <span style={{ color: '#94a3b8' }}>回應耗時:</span>
                      <span style={{ color: '#34d399', fontWeight: 500 }}>
                        {msg.meta?.latencyMs ? `${msg.meta.latencyMs} ms` : '快取即時回覆'}
                      </span>

                      <span style={{ color: '#94a3b8' }}>Token 統計:</span>
                      <span style={{ color: '#e2e8f0' }}>
                        {msg.meta?.tokens ? (
                          <span>
                            共 <strong style={{ color: '#60a5fa' }}>{msg.meta.tokens.total}</strong> ({msg.meta.tokens.prompt} in / {msg.meta.tokens.output} out)
                          </span>
                        ) : (
                          '--'
                        )}
                      </span>

                      <span style={{ color: '#94a3b8' }}>容錯狀態:</span>
                      <span style={{ color: msg.meta?.fallbackOccurred ? '#f59e0b' : '#34d399' }}>
                        {msg.meta?.fallbackOccurred ? '已自動平滑備援切換' : '最優模型正常服務'}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action / Command Badge Pill (Terminal style matching reference image) */}
              {msg.actionBadge && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#0f172a',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-mono, monospace), ui-monospace, monospace',
                    fontSize: '11px',
                    marginBottom: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={msg.actionBadge}
                >
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>$</span>
                  <span style={{ color: '#e2e8f0' }}>{msg.actionBadge}</span>
                </div>
              )}

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
              {/* Message Footer (As shown in reference image: Copy button on left, timestamp • model • tokens on right) */}
              {msg.role === 'model' && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#94a3b8',
                    userSelect: 'none',
                  }}
                >
                  {/* Left: Copy button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCopyContent(msg.id, msg.content)
                    }}
                    title={copiedMessageId === msg.id ? '已複製內容至剪貼簿！' : '複製內容'}
                    aria-label="複製內容"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: copiedMessageId === msg.id ? '#16a34a' : '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (copiedMessageId !== msg.id) e.currentTarget.style.color = '#475569'
                    }}
                    onMouseLeave={(e) => {
                      if (copiedMessageId !== msg.id) e.currentTarget.style.color = '#94a3b8'
                    }}
                  >
                    {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedMessageId === msg.id && <span style={{ fontSize: '10px' }}>已複製</span>}
                  </button>

                  {/* Right: Timestamp • Model • Credits/Tokens */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '10.5px',
                      color: '#94a3b8',
                      cursor: 'help',
                    }}
                    title="滑鼠懸停於回應內容上方可檢視詳細指標"
                  >
                    <span>{msg.timestamp}</span>
                    <span>•</span>
                    <span>{msg.meta?.displayModel || 'Auto (3.6-flash)'}</span>
                    <span>•</span>
                    <span>
                      {msg.meta?.tokens?.total
                        ? `${(msg.meta.tokens.total / 1000).toFixed(1)}k tokens`
                        : '0.3 credits'}
                    </span>
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
          width: `${sidebarWidth || (isPanelExpanded ? 460 : 360)}px`,
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
          width: isPanelExpanded ? '460px' : '360px',
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
