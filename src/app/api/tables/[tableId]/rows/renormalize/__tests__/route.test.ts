import { NextResponse } from 'next/server'
import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

const tx = { $executeRawUnsafe: jest.fn() }

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableRow: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const renormalize = (tableId = '10') =>
  POST(new Request(`http://localhost/api/tables/${tableId}/rows/renormalize`, { method: 'POST' }), {
    params: Promise.resolve({ tableId }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
})

describe('POST /api/tables/[tableId]/rows/renormalize', () => {
  it('requires canEditData', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ errorResponse: NextResponse.json({}, { status: 403 }) })

    const res = await renormalize()

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canEditData' })
    expect(prisma.tableRow.findMany).not.toHaveBeenCalled()
  })

  it('rewrites order as 1000-step gaps with placeholders scoped to the table', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 7 }, { id: 3 }])

    const res = await renormalize()

    expect(await res.json()).toEqual({ success: true, count: 2 })
    expect(prisma.tableRow.findMany).toHaveBeenCalledWith({ where: { tableId: 10 }, orderBy: { order: 'asc' }, select: { id: true } })
    const [sql, ...params] = tx.$executeRawUnsafe.mock.calls[0]
    expect(sql).toBe('UPDATE TableRow SET `order` = CASE id WHEN ? THEN ? WHEN ? THEN ? ELSE `order` END WHERE id IN (?, ?) AND tableId = ?')
    expect(params).toEqual([7, 1000, 3, 2000, 7, 3, 10])
  })

  it('continues numbering across 500-row chunks', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue(Array.from({ length: 501 }, (_, i) => ({ id: i + 1 })))

    await renormalize()

    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(2)
    const [, ...second] = tx.$executeRawUnsafe.mock.calls[1]
    expect(second).toEqual([501, 501000, 501, 10])
  })

  it('skips the transaction for an empty table and rejects a bad id', async () => {
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([])

    expect(await (await renormalize()).json()).toEqual({ success: true, count: 0 })
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect((await renormalize('abc')).status).toBe(400)
  })
})
