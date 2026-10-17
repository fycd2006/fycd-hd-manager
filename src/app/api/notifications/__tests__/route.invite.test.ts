import { POST } from '../route'
import { getSessionUser } from '@/lib/auth'
import { invalidateWorkspaceRoleCache } from '@/lib/authorize'
import prisma from '@/lib/prisma'

// Regression: accepting a workspace_invite notification upserted membership from the
// notification payload every time, so a removed member could rejoin and a demoted
// member could restore their old role by re-accepting an old notification.

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/authorize', () => ({
  invalidateWorkspaceRoleCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    notification: { findFirst: jest.fn(), update: jest.fn() },
    workspaceUser: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    workspaceInvitation: { findFirst: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  },
}))

const user = { id: 2, username: 'bob', email: 'Bob@Example.com', role: 'member' }
const notification = (data: Record<string, unknown>, read = false) => ({
  id: 40, userId: 2, type: 'workspace_invite', read, data: JSON.stringify(data),
})

const act = (action: string) =>
  POST(new Request('http://localhost/api/notifications', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: 40, action }),
  }))

const noMembershipWrites = () => {
  expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
  expect(prisma.workspaceUser.create).not.toHaveBeenCalled()
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionUser as jest.Mock).mockResolvedValue(user)
  ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue(null)
  ;(prisma.workspaceInvitation.findFirst as jest.Mock).mockResolvedValue(null)
})

describe('POST /api/notifications workspace invite handling', () => {
  it('refuses to accept a notification that was already handled', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, role: 'admin' }, true))

    const res = await act('accept')

    expect(res.status).toBe(409)
    noMembershipWrites()
    expect(invalidateWorkspaceRoleCache).not.toHaveBeenCalled()
  })

  it('does not change the role of an existing member, only marks the notification read', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, role: 'admin' }))
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ workspaceId: 5, userId: 2, role: 'viewer' })

    const res = await act('accept')

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 5, userId: 2 } },
    })
    noMembershipWrites()
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 40 }, data: { read: true } })
  })

  it('refuses to re-add a removed member when there is no pending invitation', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, role: 'editor' }))

    const res = await act('accept')

    expect(res.status).toBe(403)
    noMembershipWrites()
  })

  it('refuses when the referenced invitation no longer exists for this user email', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, inviteId: 4, role: 'admin' }))

    const res = await act('accept')

    expect(res.status).toBe(403)
    expect(prisma.workspaceInvitation.findFirst).toHaveBeenCalledWith({
      where: { id: 4, workspaceId: 5, email: 'bob@example.com' },
    })
    noMembershipWrites()
  })

  it('joins with the role stored on the pending invitation, not the notification payload', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, inviteId: 4, role: 'admin' }))
    ;(prisma.workspaceInvitation.findFirst as jest.Mock).mockResolvedValue({ id: 4, workspaceId: 5, role: 'editor' })

    const res = await act('accept')

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.create).toHaveBeenCalledWith({ data: { workspaceId: 5, userId: 2, role: 'editor' } })
    expect(prisma.workspaceUser.upsert).not.toHaveBeenCalled()
    expect(prisma.workspaceInvitation.delete).toHaveBeenCalledWith({ where: { id: 4 } })
    expect(invalidateWorkspaceRoleCache).toHaveBeenCalledWith(5, 2)
    expect(prisma.notification.update).toHaveBeenCalledWith({ where: { id: 40 }, data: { read: true } })
  })

  it('refuses to decline a notification that was already handled', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, inviteId: 4 }, true))

    const res = await act('decline')

    expect(res.status).toBe(409)
    expect(prisma.workspaceInvitation.deleteMany).not.toHaveBeenCalled()
  })

  it('only revokes an invitation addressed to the user when declining', async () => {
    ;(prisma.notification.findFirst as jest.Mock).mockResolvedValue(notification({ workspaceId: 5, inviteId: 4 }))

    const res = await act('decline')

    expect(res.status).toBe(200)
    expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 4, email: 'bob@example.com' } })
    noMembershipWrites()
  })
})
