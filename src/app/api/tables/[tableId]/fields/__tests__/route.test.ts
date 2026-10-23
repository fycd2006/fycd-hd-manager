import { GET, POST } from '../route'
import { getSessionUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { createGeneratedColumn } from '@/modules/database/services/schemaService'

// authorizeAction is NOT mocked: role checks run for real against mocked prisma/session/redis
jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/redis', () => ({
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/modules/database/services/schemaService', () => ({
  createGeneratedColumn: jest.fn().mockResolvedValue(undefined),
}))

const tx = {
  tableField: { update: jest.fn() },
  tableRow: { update: jest.fn() },
}

type TxCallback = (t: typeof tx) => unknown

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: { findFirst: jest.fn(), findUnique: jest.fn() },
    workspaceUser: { findUnique: jest.fn() },
    tableField: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    tableRow: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const asRole = (role: string) => {
  ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ workspaceId: 3, userId: 1, role })
}

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/tables/10/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tableId: '10' }) }
  )

describe('POST /api/tables/[tableId]/fields', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, username: 'alice', role: 'user' })
    ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 10, database: { workspaceId: 3 } })
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, order: 0 },
      { id: 2, order: 1 },
    ])
    ;(prisma.tableField.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: 77, ...data }))
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: TxCallback) => cb(tx))
    asRole('builder')
  })

  it('viewer cannot create fields (403, nothing created)', async () => {
    asRole('viewer')
    const res = await post({ name: '新欄位', type: 'text' })
    expect(res.status).toBe(403)
    expect(prisma.tableField.create).not.toHaveBeenCalled()
    expect(createGeneratedColumn).not.toHaveBeenCalled()
  })

  it('isIndexed: true creates a generated column for the new field; false does not', async () => {
    const res = await post({ name: '索引', type: 'number', isIndexed: true })
    expect(res.status).toBe(201)
    expect(createGeneratedColumn).toHaveBeenCalledWith(77)

    jest.clearAllMocks()
    asRole('builder')
    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: TxCallback) => cb(tx))
    ;(prisma.tableField.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: 78, ...data }))
    await post({ name: '一般', type: 'number' })
    expect(createGeneratedColumn).not.toHaveBeenCalled()
  })

  it('still returns 201 when generated column creation fails', async () => {
    ;(createGeneratedColumn as jest.Mock).mockRejectedValueOnce(new Error('DDL failed'))
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ name: '索引', type: 'number', isIndexed: true })
    expect(res.status).toBe(201)
    errSpy.mockRestore()
  })

  it('inserts relative to targetFieldId and re-sequences field order', async () => {
    const res = await post({ name: '插入', type: 'text', targetFieldId: 2, position: 'left' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ id: 77, order: 1 })
    const orderUpdates = tx.tableField.update.mock.calls.map(([arg]) => [arg.where.id, arg.data.order])
    expect(orderUpdates).toEqual([[1, 0], [77, 1], [2, 2]])
  })

  it('returns 400 when name is missing', async () => {
    const res = await post({ type: 'text' })
    expect(res.status).toBe(400)
    expect(prisma.tableField.create).not.toHaveBeenCalled()
  })

  it('backfills existing rows when adding a created_by field, keeping existing values', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      { id: 501, data: { field_1: 'a' }, createdAt: new Date() },
      { id: 502, data: JSON.stringify({ field_77: 'bob' }), createdAt: new Date() },
    ])
    const res = await post({ name: '建立者', type: 'created_by' })
    expect(res.status).toBe(201)
    expect(tx.tableRow.update).toHaveBeenCalledWith({ where: { id: 501 }, data: { data: { field_1: 'a', field_77: 'alice' } } })
    expect(tx.tableRow.update).toHaveBeenCalledWith({ where: { id: 502 }, data: { data: { field_77: 'bob' } } })
  })
})

describe('GET /api/tables/[tableId]/fields', () => {
  it('sets Server-Timing header on GET', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, username: 'alice', role: 'user' })
    ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 10, database: { workspaceId: 3 } })
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ workspaceId: 3, userId: 1, role: 'builder' })
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([])
    const res = await GET(new Request('http://localhost/api/tables/10/fields'), {
      params: Promise.resolve({ tableId: '10' }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('Server-Timing')).toContain('handler;dur=')
  })
})
