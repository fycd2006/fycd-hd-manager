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
    expect(screen.getByTitle('複製內容')).toBeInTheDocument()
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
})


