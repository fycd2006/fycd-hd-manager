/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AiAssistantBar } from '../AiAssistantBar'
import { AiDiffModal, DiffPreviewData } from '../AiDiffModal'

// Mock pusher-client
jest.mock('@/lib/pusher-client', () => ({
  getSocketId: jest.fn().mockReturnValue('mock-socket-id'),
}))

describe('AiAssistantBar & AiDiffModal Components', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
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

  it('renders AiDiffModal for delete action with warning', () => {
    const onConfirm = jest.fn()
    const onClose = jest.fn()

    const mockDiff: DiffPreviewData = {
      type: 'diff_preview',
      action: 'delete_rows',
      reason: '刪除未回報者',
      deletedRows: [{ id: 5, title: '測試成員' }],
      actionPayload: { name: 'delete_rows', args: { rowIds: [5] } },
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

    expect(screen.getByText(/即將刪除以下/i)).toBeInTheDocument()
    expect(screen.getByText('測試成員')).toBeInTheDocument()
  })
})
