import { GET, POST } from '../route'
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
    notification: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    workspaceUser: { upsert: jest.fn() },
    workspaceInvitation: { deleteMany: jest.fn() },
  },
}))

const user = { id: 2, username: 'bob', email: 'bob@example.com', role: 'member' }
const invite = {
  id: 40, userId: 2, type: 'workspace_invite',
  data: JSON.stringify({ workspaceId: 5, inviteId: 4, role: 'editor' }),
}

const act = (body: unknown) =>
  POST(new Request('http://localhost/api/notifications', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionUser as jest.Mock).mockResolvedValue(user)
  ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(invite)
})

describe('GET /api/notifications', () => {
  it('returns only the session user notifications, newest first', async () => {
    ;(prisma.notification.findMany as jest.Mock).mockResolvedValue([{ id: 1 }])

    const res = await GET()

    expect(await res.json()).toEqual({ notifications: [{ id: 1 }] })
    expect(prisma.notification.findMany).toHaveBeenCalledWith({ where: { userId: 2 }, orderBy: { createdAt: 'desc' } })
  })

  it('returns 401 without a session', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(prisma.notification.findMany).not.toHaveBeenCalled()
  })
})

describe('POST /api/notifications', () => {
  it('only acts on notifications owned by the session user', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await act({ notificationId: '40', action: 'accept' })

    expect(res.status).toBe(404)
    expect(prisma.notification.findFirst).toHaveBeenCalledWith({ where: { id: 40, userId: 2 } })
    expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
  })

  it('accepting an invite adds the user with the invited role and clears the role cache', async () => {
    const res = await act({ notificationId: 40, action: 'accept' })

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.upsert).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 5, userId: 2 } },
      update: { role: 'editor' },
      create: { workspaceId: 5, userId: 2, role: 'editor' },
    })
    expect(invalidateWorkspaceRoleCache).toHaveBeenCalledWith(5, 2)
    expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 4 } })
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 40 }, data: { read: true } })
  })

  it('declining removes the invitation without joining', async () => {
    const res = await act({ notificationId: 40, action: 'decline' })

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
    expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 4 } })
  })

  it('marks other notifications as read', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue({ id: 41, userId: 2, type: 'mention', data: null })

    const res = await act({ notificationId: 41, action: 'read' })

    expect(res.status).toBe(200)
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 41 }, data: { read: true } })
    expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 without notificationId or action, and 401 without a session', async () => {
    expect((await act({ action: 'accept' })).status).toBe(400)

    ;(getSessionUser as jest.Mock).mockResolvedValue(null)
    expect((await act({ notificationId: 40, action: 'accept' })).status).toBe(401)
    expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
  })
})
