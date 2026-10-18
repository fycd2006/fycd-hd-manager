import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'
import { syncBiDirectionalLinkRow } from '@/modules/database/services/linkRowSync'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'
import { createTableRow } from '@/modules/database/services/createRow'
import { applyOptionAdditions } from '@/modules/database/services/cellWriteOptions'

const mockGenerateContent = jest.fn()

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      NUMBER: 'NUMBER',
    },
  }
})

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/linkRowSync', () => {
  const original = jest.requireActual('@/modules/database/services/linkRowSync')
  return {
    ...original,
    syncBiDirectionalLinkRow: jest.fn().mockResolvedValue(null),
  }
})

jest.mock('@/modules/database/services/rowCascade', () => ({
  cascadeRecomputeSingleLevel: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/modules/database/services/cellWriteOptions', () => ({
  applyOptionAdditions: jest.fn().mockResolvedValue({ updated: [], remap: {} }),
}))

jest.mock('@/modules/database/services/createRow', () => ({
  createTableRow: jest.fn().mockImplementation(async ({ input }) => ({
    ok: true,
    row: { id: 999, data: input },
  })),
}))

jest.mock('@/lib/prisma', () => {
  const mockTx = {
    tableRow: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  }
  return {
    __esModule: true,
    default: {
      tableField: {
        findMany: jest.fn(),
      },
      tableRow: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockTx)),
      _mockTx: mockTx,
    },
  }
})

describe('POST /api/ai/table-agent', () => {
  const origApiKey = process.env.GEMINI_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    ;(authorizeAction as jest.Mock).mockResolvedValue({ isAuthorized: true })
  })

  afterAll(() => {
    process.env.GEMINI_API_KEY = origApiKey
  })

  it('rejects with 400 if tableId is invalid', async () => {
    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({ tableId: 'abc', userPrompt: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('無效的 Table ID')
  })

  it('returns 400 when GEMINI_API_KEY is not configured', async () => {
    delete process.env.GEMINI_API_KEY
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '名稱', type: 'text', order: 0 },
    ])

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({ tableId: 1, userPrompt: '幫我改資料', mode: 'dry_run' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('GEMINI_API_KEY')
  })

  it('handles dry_run mode with update_cells tool call and returns diff_preview', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '姓名', type: 'text', order: 0 },
      { id: 2, name: '組別', type: 'single_select', options: { choices: [{ id: 'opt_1', name: '建興組' }] } },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      { id: 101, data: JSON.stringify({ field_1: '張三', field_2: null }) },
      { id: 102, data: JSON.stringify({ field_1: '李四', field_2: '大安組' }) },
    ])

    mockGenerateContent.mockResolvedValue({
      functionCalls: [
        {
          name: 'update_cells',
          args: {
            reason: '將未分組的張三設為建興組',
            updates: [{ rowId: 101, fieldKey: 'field_2', value: '建興組' }],
          },
        },
      ],
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        userPrompt: '將未分組的張三設為建興組',
        mode: 'dry_run',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.type).toBe('diff_preview')
    expect(json.action).toBe('update_cells')
    expect(json.changes).toHaveLength(1)
    expect(json.changes[0]).toEqual({
      rowId: 101,
      rowTitle: '張三',
      fieldKey: 'field_2',
      fieldName: '組別',
      oldValue: '(空白)',
      newValue: '建興組',
    })
    expect(json.actionPayload.name).toBe('update_cells')
  })

  it('handles dry_run mode with create_rows tool call', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '姓名', type: 'text', order: 0 },
      { id: 2, name: '電話', type: 'phone', order: 1 },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([])

    mockGenerateContent.mockResolvedValue({
      functionCalls: [
        {
          name: 'create_rows',
          args: {
            reason: '新增新成員資料',
            rows: [{ field_1: '王小明', field_2: '0912345678' }],
          },
        },
      ],
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        userPrompt: '新增王小明電話0912345678',
        mode: 'dry_run',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.type).toBe('diff_preview')
    expect(json.action).toBe('create_rows')
    expect(json.newRows).toEqual([{ 姓名: '王小明', 電話: '0912345678' }])
  })

  it('executes confirmed update_cells action and broadcasts Pusher event', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '姓名', type: 'text', order: 0 },
    ])

    const mockTx = (prisma as any)._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({
      id: 101,
      tableId: 1,
      data: { field_1: '舊值' },
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: {
            updates: [{ rowId: 101, fieldKey: 'field_1', value: '新值' }],
          },
        },
        socketId: 'sock_123',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.count).toBe(1)
    expect(mockTx.tableRow.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: { data: { field_1: '新值' } },
    })
    expect(triggerTableEvent).toHaveBeenCalledWith(
      1,
      'rows-batch-changed',
      { type: 'update', count: 1 },
      'sock_123'
    )
  })

  it('executes confirmed delete_rows action and broadcasts Pusher event', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '姓名', type: 'text', order: 0 },
    ])

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'delete_rows',
          args: {
            rowIds: [101, 102],
          },
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.count).toBe(2)
    expect(prisma.tableRow.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [101, 102] }, tableId: 1 },
      data: { deletedAt: expect.any(Date) },
    })
    expect(triggerTableEvent).toHaveBeenCalledWith(
      1,
      'rows-batch-changed',
      { type: 'delete', count: 2 },
      undefined
    )
  })

  it('resolves single_select option name to UUID and boolean string to boolean on execute', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '名稱', type: 'text', order: 0 },
      {
        id: 2,
        name: '組別',
        type: 'single_select',
        options: JSON.stringify({ choices: [{ id: 'opt_group_a', name: '建興組' }] }),
        order: 1,
      },
      { id: 3, name: '已完成', type: 'boolean', order: 2 },
    ])

    const mockTx = (prisma as any)._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({
      id: 101,
      tableId: 1,
      data: { field_1: '測試人員', field_2: null, field_3: false },
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: {
            updates: [
              { rowId: 101, fieldKey: 'field_2', value: '建興組' },
              { rowId: 101, fieldKey: 'field_3', value: '是' },
            ],
          },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(mockTx.tableRow.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        data: {
          field_1: '測試人員',
          field_2: 'opt_group_a', // Successfully mapped from '建興組' to 'opt_group_a'
          field_3: true,          // Successfully coerced from '是' to true
        },
      },
    })
    expect(cascadeRecomputeSingleLevel).toHaveBeenCalledWith(1, 101)
  })

  it('formats diff preview human-readably when existing cell is stored as option UUID', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '名稱', type: 'text', order: 0 },
      {
        id: 2,
        name: '組別',
        type: 'single_select',
        options: { choices: [{ id: 'opt_old', name: '德光組' }, { id: 'opt_new', name: '建興組' }] },
        order: 1,
      },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      { id: 101, data: JSON.stringify({ field_1: '張三', field_2: 'opt_old' }) },
    ])

    mockGenerateContent.mockResolvedValue({
      functionCalls: [
        {
          name: 'update_cells',
          args: {
            reason: '調整組別',
            updates: [{ rowId: 101, fieldKey: 'field_2', value: '建興組' }],
          },
        },
      ],
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        userPrompt: '將張三從德光組改為建興組',
        mode: 'dry_run',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.changes[0]).toEqual({
      rowId: 101,
      rowTitle: '張三',
      fieldKey: 'field_2',
      fieldName: '組別',
      oldValue: '德光組', // Human-readable choice name instead of raw UUID 'opt_old'
      newValue: '建興組',
    })
  })

  it('protects formula fields from overwrite and recomputes formulas dynamically', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '底薪', type: 'number', order: 0 },
      { id: 2, name: '獎金', type: 'number', order: 1 },
      { id: 3, name: '總計', type: 'formula', options: 'field_1 + field_2', order: 2 },
    ])

    const mockTx = (prisma as any)._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({
      id: 101,
      tableId: 1,
      data: { field_1: 1000, field_2: 200, field_3: '1200' },
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: {
            updates: [
              { rowId: 101, fieldKey: 'field_1', value: 2000 },
              { rowId: 101, fieldKey: 'field_3', value: '惡意覆寫' }, // Formula field should be ignored
            ],
          },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(mockTx.tableRow.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        data: {
          field_1: 2000,
          field_2: 200,
          field_3: '2200', // Recomputed formula 2000 + 200 = 2200
        },
      },
    })
  })

  it('triggers syncBiDirectionalLinkRow when updating link_row fields', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '標案名稱', type: 'text', order: 0 },
      { id: 4, name: '指派人員', type: 'link_row', order: 1 },
    ])

    const mockTx = (prisma as any)._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({
      id: 101,
      tableId: 1,
      data: { field_1: '專案A', field_4: [] },
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: {
            updates: [{ rowId: 101, fieldKey: 'field_4', value: [201, 202] }],
          },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(syncBiDirectionalLinkRow).toHaveBeenCalledWith(1, 101, 4, [201, 202], [])
  })

  it('handles latest_comment by appending new comment entry and preserving previous comments', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '事項', type: 'text', order: 0 },
      { id: 5, name: '留言紀錄', type: 'latest_comment', order: 1 },
    ])

    const mockTx = (prisma as any)._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({
      id: 101,
      tableId: 1,
      data: {
        field_1: '專案B',
        field_5: [
          { id: '1', user: '張經理', time: '2026/09/01 10:00', content: '第一筆備註' },
        ],
      },
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: {
            updates: [{ rowId: 101, fieldKey: 'field_5', value: '今日進料檢驗合格' }],
          },
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(mockTx.tableRow.update).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        data: {
          field_1: '專案B',
          field_5: [
            { id: '1', user: '張經理', time: '2026/09/01 10:00', content: '第一筆備註' },
            expect.objectContaining({
              user: 'AI 助理 (AI Assistant)',
              content: '今日進料檢驗合格',
              time: expect.any(String),
            }),
          ],
        },
      },
    })
  })

  it('formats diff preview for latest_comment with author and content summaries', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '事項', type: 'text', order: 0 },
      { id: 5, name: '留言紀錄', type: 'latest_comment', order: 1 },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      {
        id: 101,
        data: JSON.stringify({
          field_1: '事項A',
          field_5: [
            { id: '1', user: '張經理', time: '2026/09/01 10:00', content: '採購急件待簽核' },
          ],
        }),
      },
    ])

    mockGenerateContent.mockResolvedValue({
      functionCalls: [
        {
          name: 'update_cells',
          args: {
            reason: '新增最新進度留言',
            updates: [{ rowId: 101, fieldKey: 'field_5', value: '已於今日下午完成簽核' }],
          },
        },
      ],
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        userPrompt: '幫事項A新增留言：已於今日下午完成簽核',
        mode: 'dry_run',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.changes[0]).toEqual({
      rowId: 101,
      rowTitle: '事項A',
      fieldKey: 'field_5',
      fieldName: '留言紀錄',
      oldValue: '[張經理] 採購急件待簽核',
      newValue: '已於今日下午完成簽核',
    })
  })

  it('injects selection context into model systemPrompt when context.selectedRowIds is provided', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '姓名', type: 'text', order: 0 },
      { id: 2, name: '狀態', type: 'text', order: 1 },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      { id: 201, data: JSON.stringify({ field_1: '王小明', field_2: '進行中' }) },
      { id: 202, data: JSON.stringify({ field_1: '陳美麗', field_2: '待處理' }) },
    ])

    mockGenerateContent.mockResolvedValue({
      functionCalls: [
        {
          name: 'update_cells',
          args: {
            reason: '將選取的資料列狀態改為已完成',
            updates: [{ rowId: 202, fieldKey: 'field_2', value: '已完成' }],
          },
        },
      ],
    })

    const req = new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        userPrompt: '把選中的這筆改為已完成',
        mode: 'dry_run',
        context: {
          selectedRowIds: [202],
          activeFieldKey: 'field_2',
        },
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          systemInstruction: expect.stringContaining('使用者當前在畫面中框選/鎖定的目標資料列 (共 1 列)'),
        }),
      })
    )
  })

  it('does not write a read-only cell and reports the reason in the tool result', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '底薪', type: 'number', order: 0 },
      { id: 3, name: '總計', type: 'formula', options: 'field_1', order: 1 },
    ])
    const mockTx = (prisma as unknown as { _mockTx: { tableRow: { findUnique: jest.Mock; update: jest.Mock } } })._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({ id: 101, tableId: 1, data: { field_1: 5, field_3: '5' } })

    const res = await POST(new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: { name: 'update_cells', args: { updates: [{ rowId: 101, fieldKey: 'field_3', value: '惡意覆寫' }] } },
      }),
    }))
    const json = await res.json()

    expect(json.count).toBe(0)
    expect(json.rejected).toEqual([
      expect.objectContaining({ rowId: 101, fieldKey: 'field_3', reason: expect.stringContaining('欄位 [總計] 驗證失敗：') }),
    ])
    expect(json.summary).toContain('未寫入')
    expect(mockTx.tableRow.update).not.toHaveBeenCalled()
  })

  it('reports an invalid value, keeps the stored one and still writes the valid cells', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '品名', type: 'text', order: 0 },
      { id: 2, name: '數量', type: 'number', order: 1 },
    ])
    const mockTx = (prisma as unknown as { _mockTx: { tableRow: { findUnique: jest.Mock; update: jest.Mock } } })._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({ id: 101, tableId: 1, data: { field_1: '舊', field_2: 3 } })

    const res = await POST(new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        confirmedAction: {
          name: 'update_cells',
          args: { updates: [{ rowId: 101, fieldKey: 'field_1', value: '新' }, { rowId: 101, fieldKey: 'field_2', value: 'abc' }] },
        },
      }),
    }))
    const json = await res.json()

    expect(json.count).toBe(1)
    expect(json.rejected).toHaveLength(1)
    expect(mockTx.tableRow.update).toHaveBeenCalledWith({ where: { id: 101 }, data: { data: { field_1: '新', field_2: 3 } } })
  })

  it('adds an unknown select option on update and broadcasts field-updated', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 2, name: '組別', type: 'single_select', options: { choices: [{ id: 'a', name: '甲' }] }, order: 0 },
    ])
    const mockTx = (prisma as unknown as { _mockTx: { tableRow: { findUnique: jest.Mock; update: jest.Mock } } })._mockTx
    mockTx.tableRow.findUnique.mockResolvedValue({ id: 101, tableId: 1, data: { field_2: 'a' } })
    ;(applyOptionAdditions as jest.Mock).mockResolvedValueOnce({ updated: [{ id: 2, options: { choices: [] } }], remap: {} })

    const res = await POST(new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        socketId: 's1',
        confirmedAction: { name: 'update_cells', args: { updates: [{ rowId: 101, fieldKey: 'field_2', value: '乙' }] } },
      }),
    }))

    expect((await res.json()).count).toBe(1)
    expect(applyOptionAdditions).toHaveBeenCalledWith(mockTx, 1, { 2: [expect.objectContaining({ name: '乙' })] })
    expect(triggerTableEvent).toHaveBeenCalledWith(1, 'field-updated', { field: expect.objectContaining({ id: 2 }) }, 's1')
  })

  it('creates rows with canAddOptions and broadcasts field-updated for added options', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([{ id: 1, name: '姓名', type: 'text', order: 0 }])
    ;(createTableRow as jest.Mock).mockResolvedValueOnce({
      ok: true,
      row: { id: 7, data: {} },
      updatedFields: [{ id: 2, options: { choices: [] } }],
    })

    const res = await POST(new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        socketId: 's1',
        confirmedAction: { name: 'create_rows', args: { rows: [{ field_1: 'x' }] } },
      }),
    }))

    expect(res.status).toBe(200)
    expect(createTableRow).toHaveBeenCalledWith(expect.objectContaining({ tableId: 1, canAddOptions: true }))
    expect(triggerTableEvent).toHaveBeenCalledWith(1, 'field-updated', { field: { id: 2, options: { choices: [] } } }, 's1')
  })

  it('merges options for several rows in one call and broadcasts the final options once', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 2, name: '組別', type: 'single_select', options: { choices: [{ id: 'a', name: '甲' }] }, order: 0 },
    ])
    const mockTx = (prisma as unknown as { _mockTx: { tableRow: { findUnique: jest.Mock; update: jest.Mock } } })._mockTx
    mockTx.tableRow.findUnique
      .mockResolvedValueOnce({ id: 101, tableId: 1, data: { field_2: 'a' } })
      .mockResolvedValueOnce({ id: 102, tableId: 1, data: { field_2: 'a' } })
    const finalOptions = { choices: [{ id: 'a', name: '甲' }, { id: 'x', name: '乙' }, { id: 'y', name: '丙' }] }
    ;(applyOptionAdditions as jest.Mock).mockClear()
    ;(applyOptionAdditions as jest.Mock).mockResolvedValueOnce({ updated: [{ id: 2, options: finalOptions }], remap: {} })

    await POST(new Request('http://localhost/api/ai/table-agent', {
      method: 'POST',
      body: JSON.stringify({
        tableId: 1,
        mode: 'execute',
        socketId: 's1',
        confirmedAction: {
          name: 'update_cells',
          args: { updates: [{ rowId: 101, fieldKey: 'field_2', value: '乙' }, { rowId: 102, fieldKey: 'field_2', value: '丙' }] },
        },
      }),
    }))

    expect(applyOptionAdditions).toHaveBeenCalledTimes(1)
    const additions = (applyOptionAdditions as jest.Mock).mock.calls[0][2]
    expect(additions[2].map((c: { name: string }) => c.name)).toEqual(['乙', '丙'])
    const fieldEvents = (triggerTableEvent as jest.Mock).mock.calls.filter(c => c[1] === 'field-updated')
    expect(fieldEvents).toHaveLength(1)
    expect(fieldEvents[0][2].field.options).toEqual(finalOptions)
    expect(mockTx.tableRow.update).toHaveBeenCalledTimes(2)
  })
})
