import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

// Regression: sourceRowId was trusted as-is, so an editor of their own table could
// hard-delete any row in any workspace by passing its id.

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice' }),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), createMany: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findMany: jest.fn() },
    tableRow: { findMany: jest.fn(), aggregate: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    moveOperationLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const fields = [{ id: 11, tableId: 10, name: '名稱', type: 'text', options: null }]

const move = (body: unknown) =>
  POST(new Request('http://localhost/api/tables/10/rows/move', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ tableId: '10' }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
  ;(prisma.tableRow.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 0 } })
  ;(prisma.tableRow.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  tx.tableRow.findMany.mockResolvedValue([])
})

describe('POST /api/tables/[tableId]/rows/move source row scoping', () => {
  it('refuses to move rows that are not live rows of the source table, before writing anything', async () => {
    // row 5 lives in another workspace, so the source-table lookup does not return it
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([])

    const res = await move({ sourceTableId: 10, rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_11: 'x' } }] })

    expect(res.status).toBe(404)
    expect(prisma.tableRow.findMany).toHaveBeenCalledWith({
      where: { id: { in: [5] }, tableId: 10, deletedAt: null },
      select: { id: true },
    })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.tableRow.delete).not.toHaveBeenCalled()
    expect(prisma.tableRow.deleteMany).not.toHaveBeenCalled()
  })

  it('refuses the whole batch when only some source rows belong to the source table', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 5 }])

    const res = await move({
      sourceTableId: 10,
      rows: [{ clientId: 'a', sourceRowId: 5 }, { clientId: 'b', sourceRowId: 6 }],
    })

    expect(res.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('removes source rows only from the source table', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 5 }])

    const res = await move({ sourceTableId: 10, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(200)
    expect(prisma.tableRow.delete).not.toHaveBeenCalled()
    expect(prisma.tableRow.deleteMany).toHaveBeenCalledWith({ where: { id: 5, tableId: 10 } })
  })

  it('returns 400 for a non-numeric sourceRowId', async () => {
    const res = await move({ sourceTableId: 10, rows: [{ clientId: 'c1', sourceRowId: 'abc' }] })

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
