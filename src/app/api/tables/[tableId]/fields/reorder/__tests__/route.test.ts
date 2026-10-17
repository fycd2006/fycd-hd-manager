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
  default: { $transaction: jest.fn() },
}))

const reorder = (body: unknown, tableId = '10', headers: Record<string, string> = {}) =>
  POST(new Request(`http://localhost/api/tables/${tableId}/fields/reorder`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ tableId }) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'builder' } })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
})

describe('POST /api/tables/[tableId]/fields/reorder', () => {
  it('requires canManageStructure', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ errorResponse: NextResponse.json({}, { status: 403 }) })

    const res = await reorder({ order: [3, 1] })

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canManageStructure' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('writes each position scoped to this table and broadcasts the order', async () => {
    const res = await reorder({ order: [3, 1, 2] }, '10', { 'x-socket-id': 'sock-1' })

    expect(res.status).toBe(200)
    expect(tx.tableField.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: 3, tableId: 10 }, data: { order: 0 } },
      { where: { id: 1, tableId: 10 }, data: { order: 1 } },
      { where: { id: 2, tableId: 10 }, data: { order: 2 } },
    ])
    expect(triggerTableEvent).toHaveBeenCalledWith(10, 'fields-reordered', { order: [3, 1, 2] }, 'sock-1')
  })

  it('accepts the legacy fieldOrders object format', async () => {
    await reorder({ fieldOrders: [{ id: 2 }, { id: 1 }] })

    expect(tx.tableField.update).toHaveBeenNthCalledWith(1, { where: { id: 2, tableId: 10 }, data: { order: 0 } })
  })

  it('returns 400 for a non-array order or a bad table id', async () => {
    expect((await reorder({ order: 'nope' })).status).toBe(400)
    expect((await reorder({ order: [] }, 'abc')).status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 500 and does not broadcast when a field is not in this table', async () => {
    tx.tableField.update.mockRejectedValueOnce(new Error('Record to update not found'))

    const res = await reorder({ order: [999] })

    expect(res.status).toBe(500)
    expect(triggerTableEvent).not.toHaveBeenCalled()
  })
})
