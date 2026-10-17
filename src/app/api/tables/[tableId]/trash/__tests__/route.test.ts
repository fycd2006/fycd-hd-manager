import { NextResponse } from 'next/server'
import { GET, POST, DELETE } from '../route'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/linkRowSync', () => ({
  cleanupRowLinkRowRelations: jest.fn().mockResolvedValue(undefined),
  cleanupInboundLinkRowReferences: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/masterViewOverride', () => ({
  softDeleteMasterViewOverrides: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { update: jest.fn(), findMany: jest.fn() },
    tableRow: { update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        return callback({
          $executeRaw: jest.fn(),
          tableField: { delete: jest.fn() },
          tableRow: { delete: jest.fn() },
        })
      }
      return Promise.resolve([])
    }),
  },
}))

describe('Trash Route Handler: /api/tables/[tableId]/trash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('DELETE with type=field: should execute JSON_REMOVE on TableRow and delete TableField inside transaction', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })

    const mockExecuteRaw = jest.fn().mockResolvedValue(1)
    const mockFieldDelete = jest.fn().mockResolvedValue({ id: 50 })

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        $executeRaw: mockExecuteRaw,
        tableField: { delete: mockFieldDelete },
      })
    })

    const request = new Request('http://localhost:3000/api/tables/10/trash?type=field&id=50', {
      method: 'DELETE',
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await DELETE(request, { params })
    expect(response.status).toBe(200)

    // Assert transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()
    // Assert JSON_REMOVE SQL was executed
    expect(mockExecuteRaw).toHaveBeenCalled()
    // Assert tableField.delete was executed
    expect(mockFieldDelete).toHaveBeenCalledWith({
      where: { id: 50, tableId: 10 },
    })
  })
})

describe('Trash restore & listing: /api/tables/[tableId]/trash', () => {
  const restore = (body: unknown) =>
    POST(
      new Request('http://localhost:3000/api/tables/10/trash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ tableId: '10' }) }
    )

  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
    ;(prisma.tableField.update as jest.Mock).mockResolvedValue({ id: 50 })
    ;(prisma.tableRow.update as jest.Mock).mockResolvedValue({ id: 60 })
  })

  it('POST restore field: clears deletedAt scoped to {id, tableId} and invalidates cache', async () => {
    const res = await restore({ type: 'field', id: '50' })
    expect(res.status).toBe(200)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canEditData' })
    expect(prisma.tableField.update).toHaveBeenCalledWith({ where: { id: 50, tableId: 10 }, data: { deletedAt: null } })
    expect(invalidateMasterViewCacheForTable).toHaveBeenCalledWith(10)
  })

  it('POST restore row: clears deletedAt scoped to {id, tableId}', async () => {
    const res = await restore({ type: 'row', id: 60 })
    expect(res.status).toBe(200)
    expect(prisma.tableRow.update).toHaveBeenCalledWith({ where: { id: 60, tableId: 10 }, data: { deletedAt: null } })
  })

  it('POST restore of an id from another table/workspace fails instead of restoring it', async () => {
    // Prisma throws P2025 when the scoped where {id, tableId} matches no record
    ;(prisma.tableRow.update as jest.Mock).mockRejectedValue(new Error('Record to update not found.'))
    const res = await restore({ type: 'row', id: 999 })
    expect(res.status).not.toBe(200)
    expect(prisma.tableRow.update).toHaveBeenCalledWith({ where: { id: 999, tableId: 10 }, data: { deletedAt: null } })
    expect(invalidateMasterViewCacheForTable).not.toHaveBeenCalled()
  })

  it('POST returns 400 for invalid type or id', async () => {
    expect((await restore({ type: 'view', id: 1 })).status).toBe(400)
    expect((await restore({ type: 'row', id: 'abc' })).status).toBe(400)
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })

  it('POST returns 403 without canEditData and restores nothing', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }),
    })
    const res = await restore({ type: 'field', id: 50 })
    expect(res.status).toBe(403)
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })

  it('GET lists only soft-deleted items and parses string row data', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([{ id: 50 }])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 60, data: JSON.stringify({ field_1: 'x' }) }])

    const res = await GET(new Request('http://localhost:3000/api/tables/10/trash'), {
      params: Promise.resolve({ tableId: '10' }),
    })

    expect(res.status).toBe(200)
    const deletedOnly = { tableId: 10, NOT: { deletedAt: null } }
    expect(prisma.tableField.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: deletedOnly }))
    expect(prisma.tableRow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: deletedOnly }))
    expect(await res.json()).toEqual({ fields: [{ id: 50 }], rows: [{ id: 60, data: { field_1: 'x' } }] })
  })
})
