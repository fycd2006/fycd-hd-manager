import type { TrashEntry } from '@/modules/database/types'
import { GET } from '../route'
import { getSessionUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({ getSessionUser: jest.fn() }))
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { workspace: { findMany: jest.fn() } },
}))

const DAY = 24 * 60 * 60 * 1000

describe('GET /api/trash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 without session', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('lists a deleted workspace only for members with canManageWorkspace', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 5, role: 'user' })
    const deletedAt = new Date(Date.now() - DAY)
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'A', deletedAt, members: [{ role: 'viewer' }], databases: [] },
      { id: 2, name: 'B', deletedAt, members: [{ role: 'admin' }], databases: [] },
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.items.map((i: TrashEntry) => i.id)).toEqual([2])
    expect(body.items[0]).toMatchObject({ type: 'workspace', name: 'B', parentName: null })
  })

  it('omits tables deleted together with their database', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 5, role: 'admin' })
    const T = new Date(Date.now() - DAY)
    const later = new Date(Date.now() - 2 * 60 * 1000)
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1, name: 'W', deletedAt: null, members: [],
        databases: [
          {
            id: 10, name: 'D', deletedAt: T,
            tables: [{ id: 100, name: 'T1', deletedAt: T }],
          },
          {
            id: 11, name: 'D2', deletedAt: null,
            tables: [{ id: 101, name: 'T2', deletedAt: later }],
          },
        ],
      },
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.items.map((i: TrashEntry) => `${i.type}:${i.id}`)).toEqual(['table:101', 'database:10'])
    expect(body.items[0].parentName).toBe('D2')
  })

  it('computes daysLeft from deletedAt', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 5, role: 'admin' })
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'W', deletedAt: new Date(Date.now() - 3 * DAY - 1000), members: [], databases: [] },
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.items[0].daysLeft).toBe(27)
  })

  it('uses the member role over system admin, matching authorizeAction', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 5, role: 'admin' })
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'A', deletedAt: new Date(Date.now() - DAY), members: [{ role: 'viewer' }], databases: [] },
    ])
    const res = await GET()
    const body = await res.json()
    expect(body.items).toEqual([])
  })
})
