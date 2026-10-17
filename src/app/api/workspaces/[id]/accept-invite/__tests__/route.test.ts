import { POST } from '../route'
import { getSessionUser } from '@/lib/auth'
import { invalidateWorkspaceRoleCache } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/authorize', () => ({
  invalidateWorkspaceRoleCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workspace: { findUnique: jest.fn() },
    workspaceUser: { findUnique: jest.fn(), create: jest.fn() },
    workspaceInvitation: { findFirst: jest.fn(), delete: jest.fn() },
  },
}))

const accept = (id = '5') =>
  POST(new Request(`http://localhost/api/workspaces/${id}/accept-invite`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  })

describe('POST /api/workspaces/[id]/accept-invite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 2, username: 'bob', email: 'Bob@Example.com', role: 'member' })
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({ id: 5, name: '伙食團' })
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.workspaceInvitation.findFirst as jest.Mock).mockResolvedValue({ id: 4, role: 'editor' })
  })

  it('refuses to join a workspace without an invitation for the user email', async () => {
    ;(prisma.workspaceInvitation.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await accept()

    expect(res.status).toBe(403)
    expect(prisma.workspaceUser.create).not.toHaveBeenCalled()
  })

  it('joins with the invited role, consumes the invitation and clears the role cache', async () => {
    const res = await accept()

    expect(res.status).toBe(200)
    expect(prisma.workspaceInvitation.findFirst).toHaveBeenCalledWith({
      where: { workspaceId: 5, email: 'bob@example.com' },
    })
    expect(prisma.workspaceUser.create).toHaveBeenCalledWith({
      data: { workspaceId: 5, userId: 2, role: 'editor', twoFactor: false },
    })
    expect(prisma.workspaceInvitation.delete).toHaveBeenCalledWith({ where: { id: 4 } })
    expect(invalidateWorkspaceRoleCache).toHaveBeenCalledWith(5, 2)
  })

  it('is a no-op for an existing member', async () => {
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ id: 10 })

    const res = await accept()

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.create).not.toHaveBeenCalled()
  })

  it('requires login', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await accept()

    expect(res.status).toBe(401)
  })

  it('returns 404 for a missing workspace and 400 for a bad id', async () => {
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)
    expect((await accept()).status).toBe(404)
    expect((await accept('abc')).status).toBe(400)
  })
})
