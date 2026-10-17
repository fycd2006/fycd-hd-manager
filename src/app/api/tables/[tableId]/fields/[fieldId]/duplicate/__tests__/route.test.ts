import { NextResponse } from 'next/server'
import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

const tx = { tableField: { update: jest.fn() } }

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    tableRow: { findMany: jest.fn() },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}))

const duplicate = (tableId = '10', fieldId = '2') =>
  POST(new Request(`http://localhost/api/tables/${tableId}/fields/${fieldId}/duplicate`, { method: 'POST' }), {
    params: Promise.resolve({ tableId, fieldId }),
  })

const sqlText = (call: unknown[]) => (call[0] as { strings: string[] }).strings.join('?')
const sqlValues = (call: unknown[]) => (call[0] as { values: unknown[] }).values

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'builder' } })
  ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue({ id: 2, tableId: 10, name: '價格', type: 'number', options: { precision: 2 } })
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }])
  ;(prisma.tableField.create as jest.Mock).mockResolvedValue({ id: 9, name: '價格 (Copy)' })
  ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 100 }, { id: 101 }])
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
})

describe('POST /api/tables/[tableId]/fields/[fieldId]/duplicate', () => {
  it('requires canManageStructure', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ errorResponse: NextResponse.json({}, { status: 403 }) })

    const res = await duplicate()

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canManageStructure' })
    expect(prisma.tableField.create).not.toHaveBeenCalled()
  })

  it('returns 404 when the field does not belong to the table', async () => {
    ;(prisma.tableField.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await duplicate()

    expect(res.status).toBe(404)
    expect(prisma.tableField.findUnique).toHaveBeenCalledWith({ where: { id: 2, tableId: 10 } })
    expect(prisma.tableField.create).not.toHaveBeenCalled()
  })

  it('inserts the copy right after the source and re-indexes every field', async () => {
    const res = await duplicate()

    expect(res.status).toBe(201)
    expect(prisma.tableField.create).toHaveBeenCalledWith({
      data: { tableId: 10, name: '價格 (Copy)', type: 'number', order: 2, options: { precision: 2 } },
    })
    expect(tx.tableField.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 1 }, data: { order: 0 } },
      { where: { id: 2 }, data: { order: 1 } },
      { where: { id: 9 }, data: { order: 2 } },
      { where: { id: 3 }, data: { order: 3 } },
    ])
  })

  it('copies cell values with parameterised SQL scoped to this table', async () => {
    await duplicate()

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
    const call = (prisma.$executeRaw as jest.Mock).mock.calls[0]
    expect(sqlText(call)).toContain('AND tableId = ?')
    expect(sqlText(call)).toContain('AND deletedAt IS NULL')
    expect(sqlValues(call)).toEqual(expect.arrayContaining(['$.field_9', '$.field_2', 100, 101, 10]))
    expect(triggerTableEvent).toHaveBeenCalledWith(10, 'field-created', { field: { id: 9, name: '價格 (Copy)' } }, undefined)
  })

  it('copies in chunks of 500 rows', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue(Array.from({ length: 1001 }, (_, i) => ({ id: i + 1 })))

    await duplicate()

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(3)
  })

  it('returns 400 for non-numeric ids', async () => {
    expect((await duplicate('abc', '2')).status).toBe(400)
    expect((await duplicate('10', 'x')).status).toBe(400)
  })
})
