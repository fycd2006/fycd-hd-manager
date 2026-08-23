import { NextResponse } from 'next/server'
import { GET, POST, PATCH, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableView: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

describe('Route Handler Integration: /api/tables/[tableId]/views', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'admin' },
    })
  })

  describe('GET /api/tables/[tableId]/views', () => {
    it('returns existing views for a table', async () => {
      const mockViews = [
        { id: 1, tableId: 10, name: '預設視圖', type: 'grid', filters: null, groupByField: null },
      ]
      ;(prisma.tableView.findMany as jest.Mock).mockResolvedValue(mockViews)

      const request = new Request('http://localhost:3000/api/tables/10/views')
      const response = await GET(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockViews)
    })

    it('auto-creates default grid view if no views exist', async () => {
      ;(prisma.tableView.findMany as jest.Mock).mockResolvedValue([])
      const createdDefault = { id: 2, tableId: 10, name: '預設表格視圖', type: 'grid' }
      ;(prisma.tableView.create as jest.Mock).mockResolvedValue(createdDefault)

      const request = new Request('http://localhost:3000/api/tables/10/views')
      const response = await GET(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.tableView.create).toHaveBeenCalledWith({
        data: {
          tableId: 10,
          name: '預設表格視圖',
          type: 'grid',
        },
      })
      expect(data).toEqual([createdDefault])
    })
  })

  describe('POST /api/tables/[tableId]/views', () => {
    it('creates a new view', async () => {
      const createdView = { id: 3, tableId: 10, name: '分組視圖', type: 'grid' }
      ;(prisma.tableView.create as jest.Mock).mockResolvedValue(createdView)

      const request = new Request('http://localhost:3000/api/tables/10/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '分組視圖', type: 'grid' }),
      })

      const response = await POST(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data).toEqual(createdView)
    })
  })

  describe('PATCH /api/tables/[tableId]/views', () => {
    it('updates view with groupByField, filters, sort, and avoids double-stringification', async () => {
      const mockUpdated = {
        id: 1,
        tableId: 10,
        name: '更新視圖',
        groupByField: 'field_5',
        filters: '[{"fieldKey":"field_1","operator":"contains","value":"test"}]',
        sortField: 'field_2',
        sortOrder: 'desc',
        hiddenFields: '["field_3"]',
      }
      ;(prisma.tableView.update as jest.Mock).mockResolvedValue(mockUpdated)

      const request = new Request('http://localhost:3000/api/tables/10/views', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId: 1,
          groupByField: 'field_5',
          filters: '[{"fieldKey":"field_1","operator":"contains","value":"test"}]', // already a string
          sortField: 'field_2',
          sortOrder: 'desc',
          hiddenFields: ['field_3'], // raw array
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.tableView.update).toHaveBeenCalledWith({
        where: { id: 1, tableId: 10 },
        data: expect.objectContaining({
          groupByField: 'field_5',
          filters: '[{"fieldKey":"field_1","operator":"contains","value":"test"}]', // not double stringified!
          sortField: 'field_2',
          sortOrder: 'desc',
          hiddenFields: '["field_3"]',
        }),
      })
      expect(data).toEqual(mockUpdated)
    })

    it('updates view with aggregations mapping', async () => {
      const mockUpdated = {
        id: 1,
        tableId: 10,
        name: '更新視圖',
        aggregations: '{"123":"sum","456":"avg"}',
      }
      ;(prisma.tableView.update as jest.Mock).mockResolvedValue(mockUpdated)

      const request = new Request('http://localhost:3000/api/tables/10/views', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewId: 1,
          aggregations: { 123: 'sum', 456: 'avg' },
        }),
      })

      const response = await PATCH(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(prisma.tableView.update).toHaveBeenCalledWith({
        where: { id: 1, tableId: 10 },
        data: expect.objectContaining({
          aggregations: '{"123":"sum","456":"avg"}',
        }),
      })
      expect(data).toEqual(mockUpdated)
    })
  })

  describe('DELETE /api/tables/[tableId]/views', () => {
    it('deletes view when more than 1 view exists', async () => {
      ;(prisma.tableView.count as jest.Mock).mockResolvedValue(2)
      ;(prisma.tableView.delete as jest.Mock).mockResolvedValue({ id: 2 })

      const request = new Request('http://localhost:3000/api/tables/10/views?viewId=2', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('視圖已刪除')
      expect(prisma.tableView.delete).toHaveBeenCalledWith({
        where: { id: 2, tableId: 10 },
      })
    })

    it('rejects deletion of the only remaining view', async () => {
      ;(prisma.tableView.count as jest.Mock).mockResolvedValue(1)

      const request = new Request('http://localhost:3000/api/tables/10/views?viewId=1', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ tableId: '10' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('無法刪除唯一的視圖')
    })
  })
})
