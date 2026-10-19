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
    database: { findUnique: jest.fn() },
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

    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma))
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

    // Restoring a deleted table must authorize with includeDeleted
    expect(authorizeAction).toHaveBeenCalledWith({
      tableId: 10,
      action: 'canManageStructure',
      includeDeleted: true,
    })

    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    // Restore runs as a single interactive transaction callback
    expect(typeof (prisma.$transaction as jest.Mock).mock.calls[0][0]).toBe('function')

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

    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma))
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

  it('PATCH: ordinary update keeps default authorization (deleted tables stay hidden)', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'owner' },
    })
    ;(prisma.databaseTable.update as jest.Mock).mockResolvedValue({ id: 10, name: 'New' })

    const request = new Request('http://localhost:3000/api/tables/10', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ tableId: '10' }) })

    expect(response.status).toBe(200)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canManageStructure' })
  })

  describe('PATCH: moving a table to another database', () => {
    const move = (databaseId: unknown) =>
      PATCH(
        new Request('http://localhost:3000/api/tables/10', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ databaseId }),
        }),
        { params: Promise.resolve({ tableId: '10' }) }
      )

    beforeEach(() => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'owner' } })
      ;(prisma.databaseTable.update as jest.Mock).mockResolvedValue({ id: 10, databaseId: 7 })
    })

    it('rejects a soft-deleted target database with 400', async () => {
      ;(prisma.database.findUnique as jest.Mock).mockResolvedValue({ deletedAt: new Date(), workspace: { deletedAt: null } })
      const response = await move(7)
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('請先還原資料庫')
      expect(prisma.databaseTable.update).not.toHaveBeenCalled()
    })

    it('rejects a target database in a soft-deleted workspace with 400', async () => {
      ;(prisma.database.findUnique as jest.Mock).mockResolvedValue({ deletedAt: null, workspace: { deletedAt: new Date() } })
      const response = await move(7)
      expect(response.status).toBe(400)
      expect(prisma.databaseTable.update).not.toHaveBeenCalled()
    })

    it('returns 404 when the target database does not exist', async () => {
      ;(prisma.database.findUnique as jest.Mock).mockResolvedValue(null)
      const response = await move(7)
      expect(response.status).toBe(404)
      expect(prisma.databaseTable.update).not.toHaveBeenCalled()
    })

    it.each([['abc'], [0], [-3], [1.5]])('rejects invalid databaseId %p with 400', async (bad) => {
      const response = await move(bad)
      expect(response.status).toBe(400)
      expect(prisma.databaseTable.update).not.toHaveBeenCalled()
    })

    it('moves the table when the target database is active', async () => {
      ;(prisma.database.findUnique as jest.Mock).mockResolvedValue({ deletedAt: null, workspace: { deletedAt: null } })
      const response = await move(7)
      expect(response.status).toBe(200)
      expect(prisma.databaseTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ databaseId: 7 }) })
      )
    })
  })
})
