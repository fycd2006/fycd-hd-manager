import { NextResponse } from 'next/server'
import { PATCH, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { createGeneratedColumn, dropGeneratedColumn } from '@/modules/database/services/schemaService'
import { migrateSelectFieldsForTable } from '@/modules/database/services/selectFieldMigration'
import { cleanupFieldDependencies } from '@/modules/database/services/rowCascade'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/modules/database/services/schemaService', () => ({
  createGeneratedColumn: jest.fn().mockResolvedValue(undefined),
  dropGeneratedColumn: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/selectFieldMigration', () => ({
  migrateSelectFieldsForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/modules/database/services/rowCascade', () => ({
  cleanupFieldDependencies: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    tableRow: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  },
}))

const allow = () => ({ auth: { user: { id: 1 }, role: 'builder' } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })

const patch = (body: unknown, tableId = '10', fieldId = '50') =>
  PATCH(
    new Request(`http://localhost/api/tables/${tableId}/fields/${fieldId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tableId, fieldId }) }
  )

const del = (tableId = '10', fieldId = '50') =>
  DELETE(
    new Request(`http://localhost/api/tables/${tableId}/fields/${fieldId}`, { method: 'DELETE' }),
    { params: Promise.resolve({ tableId, fieldId }) }
  )

const field = (overrides: Record<string, unknown> = {}) => ({
  id: 50, tableId: 10, name: '欄位', type: 'text', isIndexed: false, order: 1, options: null, ...overrides,
})

describe('PATCH /api/tables/[tableId]/fields/[fieldId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field())
    ;(prisma.tableField.update as jest.Mock).mockImplementation(async ({ data }) => field(data))
  })

  it('requires canEditData for options-only updates and canManageStructure for name/type changes', async () => {
    await patch({ options: { choices: [] } })
    expect(authorizeAction).toHaveBeenLastCalledWith({ tableId: 10, action: 'canEditData' })

    await patch({ name: '新名稱' })
    expect(authorizeAction).toHaveBeenLastCalledWith({ tableId: 10, action: 'canManageStructure' })

    await patch({ type: 'number' })
    expect(authorizeAction).toHaveBeenLastCalledWith({ tableId: 10, action: 'canManageStructure' })
  })

  it('returns 403 and does not update when authorization fails', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())
    const res = await patch({ name: 'x' })
    expect(res.status).toBe(403)
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })

  it('changing type of an indexed field drops then recreates the generated column, without rewriting row data', async () => {
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field({ isIndexed: true, type: 'text' }))
    const res = await patch({ type: 'number' })
    expect(res.status).toBe(200)

    expect(dropGeneratedColumn).toHaveBeenCalledWith(50)
    expect(createGeneratedColumn).toHaveBeenCalledWith(50)
    const dropOrder = (dropGeneratedColumn as jest.Mock).mock.invocationCallOrder[0]
    const createOrder = (createGeneratedColumn as jest.Mock).mock.invocationCallOrder[0]
    expect(dropOrder).toBeLessThan(createOrder)

    // Current behavior: type conversion does not convert existing cell values
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
    expect(prisma.tableRow.updateMany).not.toHaveBeenCalled()
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('toggling isIndexed creates or drops the generated column', async () => {
    await patch({ isIndexed: true })
    expect(createGeneratedColumn).toHaveBeenCalledWith(50)
    expect(dropGeneratedColumn).not.toHaveBeenCalled()

    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field({ isIndexed: true }))
    ;(prisma.tableField.update as jest.Mock).mockImplementation(async ({ data }) => field(data))
    await patch({ isIndexed: false })
    expect(dropGeneratedColumn).toHaveBeenCalledWith(50)
    expect(createGeneratedColumn).not.toHaveBeenCalled()
  })

  it('migrates select data when type becomes single_select', async () => {
    await patch({ type: 'single_select' })
    expect(migrateSelectFieldsForTable).toHaveBeenCalledWith(10, 50)
  })

  it('rejects updating a field that belongs to a different table than the URL (cross-table IDOR)', async () => {
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field({ id: 99, tableId: 20 }))
    const res = await patch({ name: '被竄改' }, '10', '99')
    expect(res.status).toBe(404)
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/tables/[tableId]/fields/[fieldId]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
    ;(prisma.tableField.findFirst as jest.Mock).mockResolvedValue(field({ id: 1, order: 0 }))
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field())
    ;(prisma.tableField.update as jest.Mock).mockResolvedValue(field())
  })

  it('refuses to delete the primary (first-order) field', async () => {
    const res = await del('10', '1')
    expect(res.status).toBe(400)
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })

  it('soft-deletes without touching row data, cleans dependencies and drops the generated column if indexed', async () => {
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field({ isIndexed: true }))
    const res = await del()
    expect(res.status).toBe(200)

    expect(prisma.tableField.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } })
    )
    // Residual field_50 keys stay in TableRow.data so the field can be restored from trash
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
    expect(cleanupFieldDependencies).toHaveBeenCalledWith(50)
    expect(dropGeneratedColumn).toHaveBeenCalledWith(50)
  })

  it('rejects deleting a field that belongs to a different table than the URL (cross-table IDOR)', async () => {
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(field({ id: 99, tableId: 20 }))
    const res = await del('10', '99')
    expect(res.status).toBe(404)
    expect(prisma.tableField.update).not.toHaveBeenCalled()
    expect(cleanupFieldDependencies).not.toHaveBeenCalled()
  })
})
