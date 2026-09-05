/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AiAssistantBar } from '../AiAssistantBar'
import { AiDiffModal, DiffPreviewData } from '../AiDiffModal'
import { AiAssistantModal } from '../AiAssistantModal'

// Mock pusher-client
jest.mock('@/lib/pusher-client', () => ({
  getSocketId: jest.fn().mockReturnValue('mock-socket-id'),
}))

// Mock MarkdownRenderer for Jest environment
jest.mock('../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}))

describe('AiAssistantModal & Components', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('renders AiAssistantModal and handles prompt analysis and diff display', async () => {
    const onClose = jest.fn()
    const addToast = jest.fn()

    const mockDiff: DiffPreviewData = {
      type: 'diff_preview',
      action: 'update_cells',
      reason: '將未分組的列設定為建興組',
      changes: [{ rowId: 1, rowTitle: '列1', fieldKey: 'field_1', fieldName: '組別', oldValue: '未分組', newValue: '建興組' }],
      actionPayload: { name: 'update_cells', args: {} },
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockDiff,
    })

    render(
      <AiAssistantModal
        tableId={1}
        isOpen={true}
        onClose={onClose}
        addToast={addToast}
      />
    )

    expect(screen.getByText('Gemini')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/向 Gemini 詢問或描述你想修改的資料/i)).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/向 Gemini 詢問或描述你想修改的資料/i)
    fireEvent.change(textarea, { target: { value: '全部改成建興組' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/table-agent', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-socket-id': 'mock-socket-id',
        }),
      }))
      expect(screen.getByText(/變更規劃：將未分組的列設定為建興組/i)).toBeInTheDocument()
      expect(screen.getByText('建興組')).toBeInTheDocument()
    })
  })

  it('renders AiAssistantBar and submits query to table-agent API', async () => {
    const onShowDiff = jest.fn()
    const addToast = jest.fn()
    const onClose = jest.fn()

    const mockDiff: DiffPreviewData = {
      type: 'diff_preview',
      action: 'update_cells',
      reason: '修改測試',
      changes: [{ rowId: 1, rowTitle: '列1', fieldKey: 'field_1', fieldName: '組別', oldValue: '', newValue: '建興組' }],
      actionPayload: { name: 'update_cells', args: {} }
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockDiff,
    })

    render(
      <AiAssistantBar
        tableId={1}
        isOpen={true}
        onClose={onClose}
        onShowDiff={onShowDiff}
        addToast={addToast}
      />
    )

    expect(screen.getByPlaceholderText(/請輸入自然語言指令/i)).toBeInTheDocument()

    const input = screen.getByPlaceholderText(/請輸入自然語言指令/i)
    fireEvent.change(input, { target: { value: '將未分組改為建興組' } })
    fireEvent.click(screen.getByText('執行分析'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/table-agent', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-socket-id': 'mock-socket-id',
        }),
      }))
      expect(onShowDiff).toHaveBeenCalledWith(mockDiff)
    })
  })

  it('renders AiDiffModal with cell changes and confirms', () => {
    const onConfirm = jest.fn()
    const onClose = jest.fn()

    const mockDiff: DiffPreviewData = {
      type: 'diff_preview',
      action: 'update_cells',
      reason: '將未分組的列設定為建興組',
      changes: [
        {
          rowId: 10,
          rowTitle: '王小明',
          fieldKey: 'field_2',
          fieldName: '組別',
          oldValue: '大安組',
          newValue: '建興組',
        },
      ],
      actionPayload: { name: 'update_cells', args: {} },
    }

    render(
      <AiDiffModal
        diff={mockDiff}
        isOpen={true}
        isApplying={false}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )

    expect(screen.getByText('AI 自動化變更預覽')).toBeInTheDocument()
    expect(screen.getByText('將未分組的列設定為建興組')).toBeInTheDocument()
    expect(screen.getByText('王小明')).toBeInTheDocument()
    expect(screen.getByText('大安組')).toBeInTheDocument()
    expect(screen.getByText('建興組')).toBeInTheDocument()

    fireEvent.click(screen.getByText('確認套用變更'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('renders AiAssistantModal in docked mode and displays selection pill', () => {
    const onClose = jest.fn()
    render(
      <AiAssistantModal
        tableId={1}
        isOpen={true}
        onClose={onClose}
        selectedRowIds={[101, 102]}
      />
    )

    // Verify docked toggle exists
    const dockBtn = screen.getByTitle('已釘選側欄')
    expect(dockBtn).toBeInTheDocument()

    // Toggle to floating modal mode
    fireEvent.click(dockBtn)
    expect(screen.getByTitle('浮動')).toBeInTheDocument()

    // Verify selection pill displays
    expect(screen.getByText(/已鎖定選取範圍/i)).toBeInTheDocument()
    expect(screen.getByText(/筆選取列/i)).toBeInTheDocument()

    // Cancel selection focus
    const cancelBtn = screen.getByText('取消鎖定')
    fireEvent.click(cancelBtn)
    expect(screen.queryByText(/已鎖定選取範圍/i)).not.toBeInTheDocument()
  })

  it('supports model selection dropdown, message hover telemetry, and copy button', async () => {
    const onClose = jest.fn()
    const mockReply = {
      type: 'text_reply',
      message: '已執行成功，最新輸出統計已更新。',
      meta: {
        model: 'gemini-3.6-flash',
        displayModel: 'Auto (3.6-flash)',
        isAuto: true,
        fallbackOccurred: false,
        latencyMs: 840,
        tokens: {
          prompt: 1120,
          output: 140,
          total: 1260,
        },
      },
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockReply,
    })

    render(
      <AiAssistantModal
        tableId={1}
        isOpen={true}
        onClose={onClose}
      />
    )

    // 1. Check model switcher pill in header
    const modelBtn = screen.getByTitle(/切換 AI 模型/i)
    expect(modelBtn).toBeInTheDocument()
    expect(modelBtn).toHaveTextContent('Auto')

    // Open dropdown
    fireEvent.click(modelBtn)
    expect(screen.getByText('模型架構選擇')).toBeInTheDocument()
    expect(screen.getByText('Gemini 3.6 Flash')).toBeInTheDocument()

    // Select Gemini 3.6 Flash
    fireEvent.click(screen.getByText('Gemini 3.6 Flash'))
    expect(modelBtn).toHaveTextContent('3.6 Flash')

    // 2. Send message with selected model
    const textarea = screen.getByPlaceholderText(/向 Gemini 詢問或描述你想修改的資料/i)
    fireEvent.change(textarea, { target: { value: '請提供各組人數統計' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/table-agent', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"requestedModel":"gemini-3.6-flash"'),
      }))
      expect(screen.getByText('已執行成功，最新輸出統計已更新。')).toBeInTheDocument()
    })

    // 3. Verify footer elements (copy button, displayModel, and token count)
    expect(screen.getAllByTitle('複製內容').length).toBeGreaterThan(0)
    expect(screen.getByText('Auto (3.6-flash)')).toBeInTheDocument()
    expect(screen.getByText('1.3k tokens')).toBeInTheDocument()

    // 4. Hover over message content to trigger telemetry popup
    const messageContent = screen.getByText('已執行成功，最新輸出統計已更新。')
    fireEvent.mouseEnter(messageContent.parentElement!)

    expect(screen.getByText('執行指標與模型資訊')).toBeInTheDocument()
    expect(screen.getByText('840 ms')).toBeInTheDocument()
    expect(screen.getByText('最優模型正常服務')).toBeInTheDocument()

    // Leave hover
    fireEvent.mouseLeave(messageContent.parentElement!)
  })

  it('supports applying diff, one-click rollback (Undo), and smart suggestions', async () => {
    const onClose = jest.fn()
    const addToast = jest.fn()

    const mockDiff = {
      type: 'diff_preview',
      action: 'update_cells',
      reason: '批次調整組別',
      changes: [
        { rowId: 5, rowTitle: '張三', fieldKey: 'field_1', fieldName: '組別', oldValue: '大安組', newValue: '建興組' },
      ],
      actionPayload: { name: 'update_cells', args: {} },
      suggestedActions: ['統計建興組人數', '查看大安組剩餘成員'],
    }

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDiff,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, summary: '已套用至資料庫' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, summary: '已成功復原' }),
      })

    render(
      <AiAssistantModal
        tableId={42}
        isOpen={true}
        onClose={onClose}
        addToast={addToast}
      />
    )

    // 1. Send query to get diff with suggestions
    const textarea = screen.getByPlaceholderText(/向 Gemini 詢問或描述你想修改的資料/i)
    fireEvent.change(textarea, { target: { value: '把張三改為建興組' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByText(/變更規劃：批次調整組別/i)).toBeInTheDocument()
      expect(screen.getByText('統計建興組人數')).toBeInTheDocument()
      expect(screen.getByText('查看大安組剩餘成員')).toBeInTheDocument()
    })

    // 2. Click Apply
    const applyBtn = screen.getByText('確認套用變更')
    fireEvent.click(applyBtn)

    await waitFor(() => {
      expect(screen.getByText('已套用至資料庫')).toBeInTheDocument()
      expect(screen.getByText(/復原此變更 \(Undo\)/i)).toBeInTheDocument()
    })

    // 3. Click Rollback (Undo)
    const undoBtn = screen.getByText(/復原此變更 \(Undo\)/i)
    fireEvent.click(undoBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/table-agent', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"reason":"復原先前操作：批次調整組別"'),
      }))
      expect(screen.getByText(/已成功復原「批次調整組別」/i)).toBeInTheDocument()
    })
  })

  it('handles voice speech input toggle and localStorage persistence', async () => {
    const onClose = jest.fn()

    // Mock SpeechRecognition in window
    const mockStart = jest.fn()
    const mockStop = jest.fn()
    ;(window as any).webkitSpeechRecognition = jest.fn().mockImplementation(() => ({
      start: mockStart,
      stop: mockStop,
      lang: '',
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    }))

    // Seed localStorage
    const savedMessages = [
      { id: 'msg-1', role: 'user', content: '先前的紀錄', timestamp: '10:00 AM' },
      { id: 'msg-2', role: 'model', content: '這是歷史回答', timestamp: '10:01 AM' },
    ]
    localStorage.setItem('fycd_ai_chat_history_99', JSON.stringify(savedMessages))

    render(
      <AiAssistantModal
        tableId={99}
        isOpen={true}
        onClose={onClose}
      />
    )

    // 1. Verify restored messages from localStorage
    expect(screen.getByText('先前的紀錄')).toBeInTheDocument()
    expect(screen.getByText('這是歷史回答')).toBeInTheDocument()

    // 2. Verify voice mic button is rendered and functional
    const micBtn = screen.getByTitle(/語音輸入 \(繁體中文\)/i)
    expect(micBtn).toBeInTheDocument()

    fireEvent.click(micBtn)
    expect(mockStart).toHaveBeenCalledTimes(1)

    // 3. Click New Chat to clear localStorage
    const newChatBtn = screen.getByTitle('新對話')
    fireEvent.click(newChatBtn)

    expect(screen.queryByText('先前的紀錄')).not.toBeInTheDocument()
    expect(localStorage.getItem('fycd_ai_chat_history_99')).toBeNull()

    delete (window as any).webkitSpeechRecognition
  })
})



