import { NextResponse } from 'next/server'
import { GET } from '../route'
import { authorizeAction } from '@/lib/authorize'
import { getMultiTableRows } from '@/modules/database/services/multiTableQuery'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/multiTableQuery', () => ({
  getMultiTableRows: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: {
      findMany: jest.fn(),
    },
  },
}))

describe('GET /api/workspaces/[id]/all-rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('negative test: should block request with 401 if user is unauthenticated', async () => {
    // Simulate authorizeAction rejecting with 401
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '未授權，請先登入' }, { status: 401 }),
    })

    const request = new Request('http://localhost:3000/api/workspaces/10/all-rows')
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    // Verification: blocked at workspace auth layer
    expect(response.status).toBe(401)
    expect(body.error).toBe('未授權，請先登入')
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 10, action: 'canViewData' })

    // Critical assertion: multi-table query was NEVER invoked and no data was leaked
    expect(getMultiTableRows).not.toHaveBeenCalled()
    expect(prisma.databaseTable.findMany).not.toHaveBeenCalled()
  })

  it('negative test: should block request with 403 if user lacks permission for the target workspace', async () => {
    // Simulate authorizeAction rejecting with 403 (user not a workspace member)
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json(
        { error: '權限不足：您未加入此工作區，無法存取或執行操作' },
        { status: 403 }
      ),
    })

    const request = new Request('http://localhost:3000/api/workspaces/99/all-rows')
    const params = Promise.resolve({ id: '99' })

    const response = await GET(request, { params })
    const body = await response.json()

    // Verification: blocked at workspace auth layer
    expect(response.status).toBe(403)
    expect(body.error).toContain('權限不足')
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 99, action: 'canViewData' })

    // Critical assertion: multi-table query was NEVER invoked and no data was returned
    expect(getMultiTableRows).not.toHaveBeenCalled()
    expect(prisma.databaseTable.findMany).not.toHaveBeenCalled()
  })

  it('positive test: should return rows when workspace authorization succeeds', async () => {
    // Simulate authorizeAction allowing access
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: {
        user: { id: 1, username: 'testuser' },
        role: 'member',
        workspaceId: 10,
      },
    })

    // Simulate batch table lookup
    ;(prisma.databaseTable.findMany as jest.Mock).mockResolvedValue([
      { id: 101 },
      { id: 102 },
    ])

    // Simulate multiTableQuery returning data
    const mockRows = [
      { id: 1, tableId: 101, data: { name: 'Row 1' }, createdAt: new Date() },
      { id: 2, tableId: 102, data: { name: 'Row 2' }, createdAt: new Date() },
    ]
    ;(getMultiTableRows as jest.Mock).mockResolvedValue({
      rows: mockRows,
      nextCursor: 'eyJjcmVhdGVkQXQiOiIyMDI2In0',
    })

    const request = new Request('http://localhost:3000/api/workspaces/10/all-rows?limit=20')
    const params = Promise.resolve({ id: '10' })

    const response = await GET(request, { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.rows).toHaveLength(2)
    expect(body.nextCursor).toBe('eyJjcmVhdGVkQXQiOiIyMDI2In0')
    expect(getMultiTableRows).toHaveBeenCalledWith({
      tableIds: [101, 102],
      cursor: null,
      limit: 20,
    })
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
})
