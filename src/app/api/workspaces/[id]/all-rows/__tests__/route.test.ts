import { NextResponse } from 'next/server'
import { GET } from '../route'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { getMultiTableRows, getAuthorizedTableIds } from '@/modules/database/services/multiTableQuery'
import { clearAllMemoryCache } from '@/modules/database/services/masterViewCache'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: { count: jest.fn().mockResolvedValue(1) },
    tableRow: { groupBy: jest.fn().mockResolvedValue([]) },
    tableField: { findMany: jest.fn().mockResolvedValue([]) },
  },
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/multiTableQuery', () => ({
  getMultiTableRows: jest.fn(),
  getAuthorizedTableIds: jest.fn(),
}))

describe('GET /api/workspaces/[id]/all-rows', () => {
  beforeEach(() => {
    clearAllMemoryCache()
    jest.clearAllMocks()
  })

  it('negative test: should block request with 401 if user is unauthenticated', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '未授權，請先登入' }, { status: 401 }),
    })

    const request = new Request('http://localhost:3000/api/workspaces/10/all-rows')
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error).toBe('未授權，請先登入')
    expect(getAuthorizedTableIds).not.toHaveBeenCalled()
    expect(getMultiTableRows).not.toHaveBeenCalled()
  })

  it('negative test: should block request with 403 if user lacks workspace permission', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }),
    })

    const request = new Request('http://localhost:3000/api/workspaces/10/all-rows')
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.error).toBe('權限不足')
    expect(getAuthorizedTableIds).not.toHaveBeenCalled()
    expect(getMultiTableRows).not.toHaveBeenCalled()
  })

  it('negative test: should return empty rows if workspace has no tables', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      membership: {
        userId: 1,
        user: { id: 1, username: 'testuser' },
        role: 'member',
        workspaceId: 10,
      },
    })
    ;(getAuthorizedTableIds as jest.Mock).mockResolvedValue([])

    const request = new Request('http://localhost:3000/api/workspaces/10/all-rows')
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rows).toEqual([])
    expect(body.nextCursor).toBeNull()
    expect(getMultiTableRows).not.toHaveBeenCalled()
  })

  it('positive test: should return rows and pass filters/sort when workspace authorization succeeds', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      membership: {
        userId: 1,
        user: { id: 1, username: 'testuser' },
        role: 'member',
        workspaceId: 10,
      },
    })
    ;(getAuthorizedTableIds as jest.Mock).mockResolvedValue([101, 102])

    const mockRows = [
      { id: 1, tableId: 101, data: { name: 'Row 1' }, createdAt: new Date() },
      { id: 2, tableId: 102, data: { name: 'Row 2' }, createdAt: new Date() },
    ]
    ;(getMultiTableRows as jest.Mock).mockResolvedValue({
      rows: mockRows,
      nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2In0',
    })

    const filters = [{ field: 'Status', operator: 'equals', value: 'Active' }]
    const url = `http://localhost:3000/api/workspaces/10/all-rows?limit=20&sortField=name&sortOrder=asc&filters=${encodeURIComponent(JSON.stringify(filters))}`
    const request = new Request(url)
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rows).toHaveLength(2)
    expect(body.nextCursor).toBe('eyJjcmVhdGVkQXQiOiIyMDI2In0')
    expect(body.tableCounts).toBeDefined()
  })

  it('positive test: should push down tableIds filter to getMultiTableRows when tableIds parameter is supplied', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      membership: {
        userId: 1,
        user: { id: 1, username: 'testuser' },
        role: 'member',
        workspaceId: 10,
      },
    })
    ;(getAuthorizedTableIds as jest.Mock).mockResolvedValue([101, 102, 103])
    ;(getMultiTableRows as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, tableId: 102, data: { name: 'Row from Table 102' }, createdAt: new Date() }],
      nextCursor: null,
    })

    const url = `http://localhost:3000/api/workspaces/10/all-rows?tableIds=102`
    const request = new Request(url)
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rows).toHaveLength(1)
    expect(getMultiTableRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tableIds: [102],
      })
    )
  })

  it('should return 400 for invalid workspace ID', async () => {
    const request = new Request('http://localhost:3000/api/workspaces/invalid-id/all-rows')
    const params = Promise.resolve({ id: 'invalid-id' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('無效的工作區 ID')
    expect(authorizeAction).not.toHaveBeenCalled()
  })

  it('should return cached result on consecutive queries without calling getMultiTableRows', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      membership: {
        userId: 1,
        user: { id: 1, username: 'testuser' },
        role: 'member',
        workspaceId: 20,
      },
    })
    ;(getAuthorizedTableIds as jest.Mock).mockResolvedValue([201])
    ;(getMultiTableRows as jest.Mock).mockResolvedValue({
      rows: [{ id: 1, tableId: 201, data: { task: 'Cached item' }, createdAt: new Date() }],
      nextCursor: null,
    })

    const request1 = new Request('http://localhost:3000/api/workspaces/20/all-rows?limit=10')
    const response1 = await GET(request1, { params: Promise.resolve({ id: '20' }) })
    const body1 = await response1.json()

    expect(response1.status).toBe(200)
    expect(body1.rows).toHaveLength(1)
    expect(getMultiTableRows).toHaveBeenCalledTimes(1)

    // Second request with same query parameters should hit cache
    const request2 = new Request('http://localhost:3000/api/workspaces/20/all-rows?limit=10')
    const response2 = await GET(request2, { params: Promise.resolve({ id: '20' }) })
    const body2 = await response2.json()

    expect(response2.status).toBe(200)
    expect(body2.rows).toHaveLength(1)
    // getMultiTableRows should NOT have been called a second time
    expect(getMultiTableRows).toHaveBeenCalledTimes(1)
  })

  it('should correctly pass masterViewId and sortFieldType derived from tableFields to getMultiTableRows', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      membership: { userId: 1, user: { id: 1, username: 'testuser' }, role: 'member', workspaceId: 30 },
    })
    ;(getAuthorizedTableIds as jest.Mock).mockResolvedValue([301])
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 99, tableId: 301, name: 'Amount', type: 'number', options: null },
    ])
    ;(getMultiTableRows as jest.Mock).mockResolvedValue({
      rows: [],
      nextCursor: null,
    })

    const request = new Request('http://localhost:3000/api/workspaces/30/all-rows?masterViewId=888&sortField=field_99&sortOrder=asc')
    const response = await GET(request, { params: Promise.resolve({ id: '30' }) })

    expect(response.status).toBe(200)
    expect(getMultiTableRows).toHaveBeenCalledWith(
      expect.objectContaining({
        masterViewId: 888,
        sortField: 'field_99',
        sortOrder: 'asc',
        sortFieldType: 'number',
      })
    )
  })
})

