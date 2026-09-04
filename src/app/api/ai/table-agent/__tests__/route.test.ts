import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'
import { syncBiDirectionalLinkRow } from '@/modules/database/services/linkRowSync'
import { cascadeRecomputeSingleLevel } from '@/modules/database/services/rowCascade'

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
})
