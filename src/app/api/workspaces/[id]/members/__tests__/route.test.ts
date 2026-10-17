import { NextResponse } from 'next/server'
import { GET, POST, PATCH, DELETE } from '../route'
import { authorizeAction, invalidateWorkspaceRoleCache } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
  invalidateWorkspaceRoleCache: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'owner', email: 'owner@example.com', role: 'member' }),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workspaceUser: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workspaceInvitation: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    workspaceTeam: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    workspace: { findUnique: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
}))

const activeUser = { id: 1, username: 'owner', email: 'owner@example.com', role: 'member' }
const allow = () => ({ auth: { user: activeUser, role: 'admin', workspaceId: 5 } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })

const ctx = (id = '5') => ({ params: Promise.resolve({ id }) })
const url = (query = '') => `http://localhost/api/workspaces/5/members${query}`
const json = (method: string, body: unknown) =>
  new Request(url(), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
  ;(prisma.workspaceUser.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.workspaceInvitation.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.workspaceTeam.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.workspaceUser.findFirst as jest.Mock).mockResolvedValue({ userId: 1 })
  ;(prisma.workspaceInvitation.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(prisma.workspaceTeam.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
})

describe('GET /api/workspaces/[id]/members', () => {
  it('requires workspace membership (canViewData)', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await GET(new Request(url()), ctx())

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 5, action: 'canViewData' })
    expect(prisma.workspaceUser.findMany).not.toHaveBeenCalled()
  })

  it('never enrolls every system user into a workspace that has no members', async () => {
    const res = await GET(new Request(url()), ctx())

    expect(res.status).toBe(200)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
    expect(prisma.workspaceUser.createMany).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ members: [], invitations: [], teams: [] })
  })

  it('returns members, invitations and teams for a member', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    ;(prisma.workspaceUser.findMany as jest.Mock).mockResolvedValue([
      { id: 9, userId: 1, role: 'admin', twoFactor: false, createdAt, user: { id: 1, username: 'owner', email: 'owner@example.com' } },
    ])
    ;(prisma.workspaceTeam.findMany as jest.Mock).mockResolvedValue([
      { id: 3, name: '廚房', description: null, members: [{ user: { id: 1, username: 'owner', email: 'owner@example.com' } }] },
    ])

    const res = await GET(new Request(url()), ctx())
    const body = await res.json()

    expect(body.members).toEqual([
      { id: 9, userId: 1, name: 'owner', email: 'owner@example.com', role: 'admin', twoFactor: false, createdAt: createdAt.toISOString() },
    ])
    expect(body.teams).toEqual([
      { id: 3, name: '廚房', description: '', memberCount: 1, members: [{ id: 1, name: 'owner', email: 'owner@example.com' }] },
    ])
  })

  it('returns 400 for a non-numeric workspace id', async () => {
    const res = await GET(new Request(url()), ctx('abc'))

    expect(res.status).toBe(400)
    expect(authorizeAction).not.toHaveBeenCalled()
  })
})

describe('POST /api/workspaces/[id]/members', () => {
  it('requires canManageMembers before inviting', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await POST(json('POST', { email: 'attacker@example.com', role: 'admin' }), ctx())

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 5, action: 'canManageMembers' })
    expect(prisma.workspaceUser.create).not.toHaveBeenCalled()
    expect(prisma.workspaceInvitation.create).not.toHaveBeenCalled()
  })

  it('requires canManageMembers before creating a team', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await POST(json('POST', { action: 'create_team', teamName: 'x' }), ctx())

    expect(res.status).toBe(403)
    expect(prisma.workspaceTeam.create).not.toHaveBeenCalled()
  })

  it('adds an existing user directly and notifies them', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 })
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({ id: 5, name: '伙食團' })
    ;(prisma.workspaceUser.create as jest.Mock).mockResolvedValue({
      id: 10, userId: 2, role: 'editor', twoFactor: false, user: { id: 2, username: 'bob', email: 'bob@example.com' },
    })

    const res = await POST(json('POST', { email: ' Bob@Example.com ', role: 'editor' }), ctx())

    expect(res.status).toBe(201)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { email: 'bob@example.com' } })
    expect(prisma.workspaceUser.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { workspaceId: 5, userId: 2, role: 'editor' },
    }))
    expect(prisma.notification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 2, type: 'workspace_invite' }) })
  })

  it('rejects inviting someone who is already a member', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 })
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ id: 10 })

    const res = await POST(json('POST', { email: 'bob@example.com' }), ctx())

    expect(res.status).toBe(400)
    expect(prisma.workspaceUser.create).not.toHaveBeenCalled()
  })

  it('creates an invitation for an email without an account', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.workspaceInvitation.create as jest.Mock).mockResolvedValue({ id: 4 })

    const res = await POST(json('POST', { email: 'new@example.com' }), ctx())

    expect(res.status).toBe(201)
    expect(prisma.workspaceInvitation.create).toHaveBeenCalledWith({
      data: { workspaceId: 5, email: 'new@example.com', role: 'member', invitedBy: 1 },
    })
  })

  it('creates a team with a trimmed name', async () => {
    ;(prisma.workspaceTeam.create as jest.Mock).mockResolvedValue({ id: 3 })

    const res = await POST(json('POST', { action: 'create_team', teamName: '  廚房 ', teamDescription: '' }), ctx())

    expect(res.status).toBe(201)
    expect(prisma.workspaceTeam.create).toHaveBeenCalledWith({ data: { workspaceId: 5, name: '廚房', description: null } })
  })

  it('returns 400 without an email', async () => {
    const res = await POST(json('POST', { email: '  ' }), ctx())

    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/workspaces/[id]/members', () => {
  it('requires canManageMembers', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await PATCH(json('PATCH', { userId: 2, role: 'admin' }), ctx())

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 5, action: 'canManageMembers' })
    expect(prisma.workspaceUser.update).not.toHaveBeenCalled()
  })

  it('updates the role and invalidates the cached role', async () => {
    ;(prisma.workspaceUser.update as jest.Mock).mockResolvedValue({ userId: 2, role: 'builder' })

    const res = await PATCH(json('PATCH', { userId: '2', role: 'builder' }), ctx())

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.update).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 5, userId: 2 } },
      data: { role: 'builder' },
    })
    expect(invalidateWorkspaceRoleCache).toHaveBeenCalledWith(5, 2)
  })

  it('refuses to change the workspace creator role', async () => {
    const res = await PATCH(json('PATCH', { userId: 1, role: 'viewer' }), ctx())

    expect(res.status).toBe(400)
    expect(prisma.workspaceUser.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/workspaces/[id]/members', () => {
  const del = (query: string) => DELETE(new Request(url(query), { method: 'DELETE' }), ctx())

  it('requires canManageMembers', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await del('?userId=2')

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 5, action: 'canManageMembers' })
    expect(prisma.workspaceUser.delete).not.toHaveBeenCalled()
  })

  it('removes a member and invalidates the cached role', async () => {
    const res = await del('?userId=2')

    expect(res.status).toBe(200)
    expect(prisma.workspaceUser.delete).toHaveBeenCalledWith({ where: { workspaceId_userId: { workspaceId: 5, userId: 2 } } })
    expect(invalidateWorkspaceRoleCache).toHaveBeenCalledWith(5, 2)
  })

  it('refuses to remove the workspace creator', async () => {
    const res = await del('?userId=1')

    expect(res.status).toBe(400)
    expect(prisma.workspaceUser.delete).not.toHaveBeenCalled()
  })

  it('only revokes invitations that belong to this workspace', async () => {
    const res = await del('?inviteId=4')

    expect(res.status).toBe(200)
    expect(prisma.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 4, workspaceId: 5 } })
    expect(prisma.workspaceInvitation.delete).not.toHaveBeenCalled()
  })

  it('returns 404 for an invitation from another workspace', async () => {
    ;(prisma.workspaceInvitation.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await del('?inviteId=99')

    expect(res.status).toBe(404)
  })

  it('only deletes teams that belong to this workspace', async () => {
    const res = await del('?teamId=3')

    expect(res.status).toBe(200)
    expect(prisma.workspaceTeam.deleteMany).toHaveBeenCalledWith({ where: { id: 3, workspaceId: 5 } })
    expect(prisma.workspaceTeam.delete).not.toHaveBeenCalled()
  })

  it('returns 404 for a team from another workspace', async () => {
    ;(prisma.workspaceTeam.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await del('?teamId=99')

    expect(res.status).toBe(404)
  })

  it('returns 400 without any target', async () => {
    const res = await del('')

    expect(res.status).toBe(400)
  })
})
