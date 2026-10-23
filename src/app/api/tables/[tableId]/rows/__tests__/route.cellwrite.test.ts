import { PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'testuser' }),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/modules/database/services/linkRowSync', () => ({
  syncBiDirectionalLinkRow: jest.fn().mockResolvedValue(null),
  cleanupRowLinkRowRelations: jest.fn().mockResolvedValue(undefined),
  parseLinkRowIds: jest.requireActual('@/modules/database/services/linkRowSync').parseLinkRowIds,
}))

jest.mock('@/modules/database/services/rowCascade', () => ({
  cascadeRecomputeSingleLevel: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCache: jest.fn().mockResolvedValue(undefined),
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    tableField: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    tableRow: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}))

const CHOICES = [{ id: 'c-a', name: 'A', color: 'blue' }]

const fields = [
  { id: 1, tableId: 10, name: '標題', type: 'text', options: null },
  { id: 2, tableId: 10, name: '數量', type: 'number', options: null },
  { id: 3, tableId: 10, name: '編號', type: 'autonumber', options: null },
  { id: 4, tableId: 10, name: '分類', type: 'single_select', options: { choices: CHOICES } },
  { id: 5, tableId: 10, name: '日期', type: 'date', options: null },
  { id: 6, tableId: 10, name: '標籤', type: 'multiple_select', options: { choices: CHOICES } },
]

const storedData = { field_1: 'old', field_5: '2026-01-02', field_6: '["c-a"]' }

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId: 100, ...body }),
    }),
    { params: Promise.resolve({ tableId: '10' }) }
  )
}

function sqlParams(callIndex = 0): unknown[] {
  return (prisma.$executeRaw as jest.Mock).mock.calls[callIndex][0].values
}

describe('PATCH /api/tables/[tableId]/rows uses cellWrite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'member' } })
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ id: 100, tableId: 10, data: JSON.stringify(storedData) })
    ;(prisma.tableRow.findUnique as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify(storedData),
      updatedAt: new Date(),
    })
    ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma))
  })

  it('rejects a write to a read-only field with 400 and writes nothing', async () => {
    const res = await patch({ data: { field_3: 9 } })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error.startsWith('欄位 [編號] 驗證失敗：')).toBe(true)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('normalizes a thousands-separated number before writing', async () => {
    const res = await patch({ data: { field_2: '1,000' } })
    expect(res.status).toBe(200)
    expect(sqlParams()).toContain(1000)
  })

  it('adds an unknown select option for an editor and emits field-updated', async () => {
    ;(prisma.tableField.findFirst as jest.Mock).mockResolvedValue(fields[3])
    ;(prisma.tableField.update as jest.Mock).mockImplementation(async ({ where, data }) => ({ id: where.id, options: data.options }))

    const res = await patch({ data: { field_4: 'New' }, socket_id: 'sock-1' })
    expect(res.status).toBe(200)

    const updateArg = (prisma.tableField.update as jest.Mock).mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 4 })
    const merged = updateArg.data.options.choices
    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual(CHOICES[0])
    expect(merged[1]).toMatchObject({ name: 'New' })

    // the stored cell is the id of the new choice, written in the same transaction
    expect(sqlParams()).toContain(merged[1].id)
    expect(triggerTableEvent).toHaveBeenCalledWith(
      10,
      'field-updated',
      { field: expect.objectContaining({ id: 4, options: updateArg.data.options }) }
    )
  })

  it('rejects an invalid number with the formatted message and opens no transaction', async () => {
    const res = await patch({ data: { field_2: 'abc' } })
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('欄位 [數量] 驗證失敗：必須是有效的數字')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('leaves untouched stored cells (ISO date string, multi-select JSON string) as they are', async () => {
    const res = await patch({ data: { field_1: 'new title' } })
    expect(res.status).toBe(200)
    const params = sqlParams()
    expect(params).toContain('$.field_1')
    expect(params).not.toContain('$.field_5')
    expect(params).not.toContain('$.field_6')
  })
})
