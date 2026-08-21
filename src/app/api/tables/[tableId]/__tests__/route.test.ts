import { DELETE, PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    databaseTable: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    tableRow: {
      updateMany: jest.fn(),
    },
    tableField: {
      updateMany: jest.fn(),
    },
  },
}))

describe('DatabaseTable Route Handler: /api/tables/[tableId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('DELETE: should cascade soft-delete to child TableRows and TableFields in a transaction', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })

    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/tables/10', {
      method: 'DELETE',
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await DELETE(request, { params })
    expect(response.status).toBe(200)

    // Assert prisma.$transaction was called with 3 operations: table, rows, fields
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const transactionArgs = (prisma.$transaction as jest.Mock).mock.calls[0][0]
    expect(transactionArgs).toHaveLength(3)

    expect(prisma.databaseTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )

    expect(prisma.tableRow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tableId: 10, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )

    expect(prisma.tableField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tableId: 10, deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      })
    )
  })

  it('PATCH: should restore ONLY child TableRows and TableFields that share the exact tableDeletedAt timestamp', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })

    const tableDeletedAt = new Date('2026-08-20T10:00:00.123Z')

    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])
    ;(prisma.databaseTable.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 10,
        deletedAt: tableDeletedAt,
      })
      .mockResolvedValueOnce({
        id: 10,
        name: 'Restored Table',
        deletedAt: null,
      })

    const request = new Request('http://localhost:3000/api/tables/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deletedAt: null,
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    const transactionArgs = (prisma.$transaction as jest.Mock).mock.calls[0][0]
    expect(transactionArgs).toHaveLength(3)

    // Table itself has deletedAt set to null
    expect(prisma.databaseTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({ deletedAt: null }),
      })
    )

    // CRITICAL: TableRow.updateMany & TableField.updateMany only target rows with deletedAt == tableDeletedAt
    expect(prisma.tableRow.updateMany).toHaveBeenCalledWith({
      where: { tableId: 10, deletedAt: tableDeletedAt },
      data: { deletedAt: null },
    })

    expect(prisma.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: 10, deletedAt: tableDeletedAt },
      data: { deletedAt: null },
    })
  })

  it('PATCH: preserves prior-deleted fields in trash when table is restored', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })

    const tableDeletedAt = new Date('2026-08-20T12:00:00.000Z')

    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])
    ;(prisma.databaseTable.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 10,
        deletedAt: tableDeletedAt,
      })
      .mockResolvedValueOnce({
        id: 10,
        name: 'Restored Table',
        deletedAt: null,
      })

    const request = new Request('http://localhost:3000/api/tables/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedAt: null }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)

    // Verify update query explicitly excludes rows/fields deleted earlier
    const fieldUpdateCall = (prisma.tableField.updateMany as jest.Mock).mock.calls[0][0]
    expect(fieldUpdateCall.where.deletedAt).toEqual(tableDeletedAt)
    // Any prior deleted field (with deletedAt e.g. 2026-08-19) would NOT match where.deletedAt
  })
})
