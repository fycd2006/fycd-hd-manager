import { NextResponse } from 'next/server'
import { POST, DELETE, PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'
import { evaluateFormula } from '@/lib/formula'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice' }),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/lib/formula', () => ({
  evaluateFormula: jest.fn(() => 42),
}))

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), createMany: jest.fn(), aggregate: jest.fn(), updateMany: jest.fn() },
  $executeRawUnsafe: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const allow = () => ({ auth: { user: { id: 1 }, role: 'editor' } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })

const fields = [
  { id: 1, name: '名稱', type: 'text', options: null },
  { id: 2, name: '數量', type: 'number', options: null },
  { id: 3, name: '修改者', type: 'last_modified_by', options: null },
]

const call = (handler: typeof POST, method: string, body: unknown, tableId = '10') =>
  handler(new Request(`http://localhost/api/tables/${tableId}/rows/batch`, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ tableId }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  tx.tableRow.aggregate.mockResolvedValue({ _max: { order: 10 } })
  tx.tableRow.findMany.mockResolvedValue([])
})

describe.each([
  ['POST', POST, { rows: [{ clientId: 'a' }] }],
  ['DELETE', DELETE, { rowIds: [1] }],
  ['PATCH', PATCH, { updates: [{ rowId: 1, data: {} }] }],
])('%s /api/tables/[tableId]/rows/batch authorization', (method, handler, body) => {
  it('requires canEditData on the table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await call(handler, method, body)

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canEditData' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-numeric table id', async () => {
    expect((await call(handler, method, body, 'abc')).status).toBe(400)
  })
})

describe('POST /api/tables/[tableId]/rows/batch', () => {
  it('validates values, stamps audit fields and appends rows in order', async () => {
    tx.tableRow.findMany.mockResolvedValue([{ id: 100, clientId: 'a', data: '{"field_1":"米"}' }])

    const res = await call(POST, 'POST', {
      rows: [{ clientId: 'a', data: { field_1: '米', field_2: '5' } }, { clientId: 'b', field_1: '鹽' }],
      socket_id: 'sock',
    })

    expect(res.status).toBe(201)
    expect(tx.tableRow.createMany).toHaveBeenCalledWith({
      data: [
        { tableId: 10, clientId: 'a', data: { field_1: '米', field_2: 5, field_3: 'alice' }, order: 11 },
        { tableId: 10, clientId: 'b', data: { field_1: '鹽', field_3: 'alice' }, order: 12 },
      ],
    })
    expect(tx.tableRow.findMany).toHaveBeenCalledWith({
      where: { tableId: 10, clientId: { in: ['a', 'b'] } }, orderBy: { order: 'asc' },
    })
    expect(await res.json()).toEqual({ rows: [{ id: 100, clientId: 'a', data: { field_1: '米' } }] })
    expect(triggerTableEvent).toHaveBeenCalledWith(10, 'rows-batch-changed', { type: 'create', count: 1 }, 'sock')
  })

  it('rejects an invalid value before opening a transaction', async () => {
    const res = await call(POST, 'POST', { rows: [{ clientId: 'a', data: { field_2: 'abc' } }] })

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('requires a clientId on every row and a non-empty rows array', async () => {
    expect((await call(POST, 'POST', { rows: [{ data: {} }] })).status).toBe(400)
    expect((await call(POST, 'POST', { rows: [] })).status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('allocates consecutive autonumbers', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([{ id: 4, name: '編號', type: 'autonumber', options: null }])
    tx.databaseTable.findUnique.mockResolvedValue({ id: 10, autonumberCounter: 3 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 5 })

    await call(POST, 'POST', { rows: [{ clientId: 'a' }, { clientId: 'b' }] })

    expect(tx.databaseTable.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { autonumberCounter: { increment: 2 } } })
    const created = tx.tableRow.createMany.mock.calls[0][0].data
    expect(created.map((r: { data: Record<string, unknown> }) => r.data.field_4)).toEqual([4, 5])
  })
})

describe('DELETE /api/tables/[tableId]/rows/batch', () => {
  it('soft-deletes rows that all belong to the table', async () => {
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, tableId: 10 }, { id: 2, tableId: 10 }])

    const res = await call(DELETE, 'DELETE', { rowIds: ['1', 2, 'x'] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, count: 2 })
    expect(tx.tableRow.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } }, data: { deletedAt: expect.any(Date) },
    })
  })

  it('refuses the whole batch when any row belongs to another table', async () => {
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, tableId: 10 }, { id: 2, tableId: 99 }])

    const res = await call(DELETE, 'DELETE', { rowIds: [1, 2] })

    expect(res.status).toBe(500)
    expect(tx.tableRow.updateMany).not.toHaveBeenCalled()
    expect(triggerTableEvent).not.toHaveBeenCalled()
  })

  it('returns 400 when no valid ids are given', async () => {
    expect((await call(DELETE, 'DELETE', { rowIds: [] })).status).toBe(400)
    expect((await call(DELETE, 'DELETE', { rowIds: ['x'] })).status).toBe(400)
  })
})

describe('PATCH /api/tables/[tableId]/rows/batch', () => {
  it('only updates live rows of this table and writes them with a scoped CASE update', async () => {
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, data: { field_1: '舊', field_2: 1 } }])

    const res = await call(PATCH, 'PATCH', {
      updates: [{ rowId: 1, data: { field_2: '7', field_999: 'ignored' } }, { rowId: 2, data: { field_1: 'x' } }],
    })

    expect(res.status).toBe(200)
    expect(tx.tableRow.findMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] }, tableId: 10, deletedAt: null } })
    const body = await res.json()
    expect(body.updates).toEqual([{
      rowId: 1,
      beforeData: { field_1: '舊', field_2: 1 },
      data: { field_1: '舊', field_2: 7, field_3: 'alice' },
    }])
    const [sql, ...params] = tx.$executeRawUnsafe.mock.calls[0]
    expect(sql).toBe('UPDATE TableRow SET updatedAt = NOW(), data = CASE id WHEN ? THEN ? ELSE data END WHERE id IN (?) AND tableId = ?')
    expect(params).toEqual([1, JSON.stringify({ field_1: '舊', field_2: 7, field_3: 'alice' }), 1, 10])
  })

  it('recomputes formula fields from the merged row', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: '數量', type: 'number', options: null },
      { id: 5, name: '小計', type: 'formula', options: { formula: '{數量} * 2' } },
    ])
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, data: {} }])

    const body = await (await call(PATCH, 'PATCH', { updates: [{ rowId: 1, data: { field_1: 21 } }] })).json()

    // the row object is mutated after the call (field_5 is written back), so match on what it held
    expect(evaluateFormula).toHaveBeenCalledWith({ formula: '{數量} * 2' }, expect.objectContaining({ field_1: 21 }), [1, 5])
    expect(body.updates[0].data.field_5).toBe('42')
  })

  it('aborts the transaction when a value fails validation', async () => {
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, data: {} }])

    const res = await call(PATCH, 'PATCH', { updates: [{ rowId: 1, data: { field_2: 'abc' } }] })

    expect(res.status).toBe(500)
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled()
  })

  it('skips the write when no requested row exists in this table', async () => {
    const res = await call(PATCH, 'PATCH', { updates: [{ rowId: 3, data: { field_1: 'x' } }] })

    expect(await res.json()).toEqual({ ok: true, updates: [] })
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled()
  })

  it('returns 400 without valid updates', async () => {
    expect((await call(PATCH, 'PATCH', { updates: [] })).status).toBe(400)
    expect((await call(PATCH, 'PATCH', { updates: [{ rowId: 'x' }] })).status).toBe(400)
  })
})
