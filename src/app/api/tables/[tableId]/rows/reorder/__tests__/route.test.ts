import { NextResponse } from 'next/server'
import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    tableRow: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  },
}))

describe('POST /api/tables/[tableId]/rows/reorder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 400 if tableId is invalid', async () => {
    const request = new Request('http://localhost/api/tables/abc/rows/reorder', {
      method: 'POST',
      body: JSON.stringify({ rowIds: [1, 2, 3] }),
    })
    const params = Promise.resolve({ tableId: 'abc' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('無效的 ID')
  })

  it('should return error response if authorization fails', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: 'Permission denied' }, { status: 403 }),
    })

    const request = new Request('http://localhost/api/tables/123/rows/reorder', {
      method: 'POST',
      body: JSON.stringify({ rowIds: [1, 2, 3] }),
    })
    const params = Promise.resolve({ tableId: '123' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Permission denied')
  })

  it('should return 400 if rowIds format is invalid', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { role: 'admin' } })

    const request = new Request('http://localhost/api/tables/123/rows/reorder', {
      method: 'POST',
      body: JSON.stringify({ invalidField: 'test' }),
    })
    const params = Promise.resolve({ tableId: '123' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('無效的排序格式')
  })

  it('should update row orders and trigger events successfully', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { role: 'admin' } })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      return cb(prisma)
    })

    const request = new Request('http://localhost/api/tables/123/rows/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowIds: [101, 102, 103], socket_id: 'sock_123' }),
    })
    const params = Promise.resolve({ tableId: '123' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(prisma.tableRow.update).toHaveBeenCalledTimes(3)
    expect(prisma.tableRow.update).toHaveBeenNthCalledWith(1, {
      where: { id: 101 },
      data: { order: 0 },
    })
    expect(prisma.tableRow.update).toHaveBeenNthCalledWith(2, {
      where: { id: 102 },
      data: { order: 1 },
    })
    expect(prisma.tableRow.update).toHaveBeenNthCalledWith(3, {
      where: { id: 103 },
      data: { order: 2 },
    })

    expect(invalidateMasterViewCacheForTable).toHaveBeenCalledWith(123)
    expect(triggerTableEvent).toHaveBeenCalledWith(
      123,
      'rows-batch-changed',
      expect.objectContaining({ type: 'reorder' }),
      'sock_123'
    )
  })
})
