import { GET } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

// Regression: GET authorized against the URL tableId but loaded comments by rowId alone,
// so a member of one table could read comments of rows in any other workspace.

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    rowComment: { findMany: jest.fn() },
    tableRow: { findFirst: jest.fn(), findUnique: jest.fn() },
  },
}))

const list = (rowId: string) =>
  GET(new Request(`http://localhost/api/tables/10/rows/comments?rowId=${rowId}`), {
    params: Promise.resolve({ tableId: '10' }),
  })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 2 }, role: 'commenter' } })
  ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/tables/[tableId]/rows/comments row scoping', () => {
  it('returns 404 without reading comments when the row is not in the authorized table', async () => {
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await list('999')

    expect(res.status).toBe(404)
    expect(prisma.tableRow.findFirst).toHaveBeenCalledWith({
      where: { id: 999, tableId: 10 },
      select: { createdAt: true, updatedAt: true },
    })
    expect(prisma.rowComment.findMany).not.toHaveBeenCalled()
  })

  it('builds the creation history entry from the scoped row lookup', async () => {
    const createdAt = new Date('2026-03-01T00:00:00Z')
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ createdAt, updatedAt: createdAt })

    const body = await (await list('30')).json()

    expect(body[0]).toMatchObject({ id: -999, rowId: 30, createdAt: createdAt.toISOString() })
    expect(prisma.tableRow.findUnique).not.toHaveBeenCalled()
  })
})
