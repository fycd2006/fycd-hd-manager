import { GET } from '../route'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workspace: { findUnique: jest.fn() },
  },
}))

const info = (id = '5') =>
  GET(new Request(`http://localhost/api/workspaces/${id}/invitation-info`), { params: Promise.resolve({ id }) })

describe('GET /api/workspaces/[id]/invitation-info', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the workspace name and the earliest member as inviter', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      id: 5, name: '伙食團', createdAt, members: [{ user: { username: 'owner' } }],
    })

    const res = await info()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 5, name: '伙食團', inviterName: 'owner', createdAt: createdAt.toISOString() })
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 },
      select: expect.objectContaining({
        members: { take: 1, orderBy: { createdAt: 'asc' }, select: { user: { select: { username: true } } } },
      }),
    }))
  })

  it('falls back to a generic inviter name when the workspace has no members', async () => {
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({ id: 5, name: 'x', createdAt: new Date(), members: [] })

    const body = await (await info()).json()

    expect(body.inviterName).toBe('團隊管理員')
  })

  it('returns 404 for a missing workspace and 400 for a bad id', async () => {
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)

    expect((await info()).status).toBe(404)
    expect((await info('abc')).status).toBe(400)
  })
})
