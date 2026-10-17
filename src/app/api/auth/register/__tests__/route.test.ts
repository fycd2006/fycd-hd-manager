import { NextResponse } from 'next/server'
import * as argon2 from 'argon2'
import { POST } from '../route'
import prisma from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rate-limiter'

const cookieSet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ set: cookieSet })),
}))

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
}))

jest.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/auth', () => ({
  createSessionToken: jest.fn(() => 'signed-token'),
}))

const tx = {
  workspaceUser: { createMany: jest.fn() },
  workspaceInvitation: { deleteMany: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findFirst: jest.fn(), count: jest.fn(), create: jest.fn() },
    workspaceInvitation: { findMany: jest.fn() },
    workspace: { create: jest.fn() },
    workspaceUser: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const register = (body: unknown) =>
  POST(
    new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

const valid = { username: 'bob', email: 'Bob@Example.com', password: 'Passw0rdX' }

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(applyRateLimit as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.count as jest.Mock).mockResolvedValue(3)
    ;(prisma.user.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: 20, ...data }))
    ;(prisma.workspaceInvitation.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.workspace.create as jest.Mock).mockResolvedValue({ id: 300 })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  })

  it('creates a member with an argon2 hash, a personal workspace, and logs in', async () => {
    const res = await register(valid)

    expect(res.status).toBe(201)
    expect(argon2.hash).toHaveBeenCalledWith('Passw0rdX')
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { username: 'bob', email: 'bob@example.com', password: '$argon2id$hashed', role: 'member' },
    })
    expect(prisma.workspaceUser.create).toHaveBeenCalledWith({
      data: { workspaceId: 300, userId: 20, role: 'admin', twoFactor: false },
    })
    expect(cookieSet).toHaveBeenCalledWith('session', 'signed-token', expect.objectContaining({ httpOnly: true }))
    const json = await res.json()
    expect(json.user).toEqual({ id: 20, username: 'bob', email: 'bob@example.com', role: 'member' })
  })

  it('makes the very first user a system admin', async () => {
    ;(prisma.user.count as jest.Mock).mockResolvedValue(0)

    await register(valid)

    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ role: 'admin' }) })
  })

  it('rejects a duplicate username or email with 400 without creating anything', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 1 })

    const res = await register(valid)

    expect(res.status).toBe(400)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ username: 'bob' }, { email: 'bob@example.com' }] },
    })
    expect(prisma.user.create).not.toHaveBeenCalled()
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it.each([
    ['short password', { ...valid, password: 'Ab1' }],
    ['no uppercase', { ...valid, password: 'password1' }],
    ['no digit', { ...valid, password: 'Password' }],
    ['bad email', { ...valid, email: 'not-an-email' }],
    ['short username', { ...valid, username: 'b' }],
  ])('returns 400 for %s', async (_label, body) => {
    const res = await register(body)

    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('accepts pending invitations instead of creating a personal workspace', async () => {
    ;(prisma.workspaceInvitation.findMany as jest.Mock).mockResolvedValue([
      { id: 1, workspaceId: 5, role: 'editor' },
      { id: 2, workspaceId: 6, role: 'viewer' },
    ])

    const res = await register(valid)

    expect(res.status).toBe(201)
    expect(prisma.workspaceInvitation.findMany).toHaveBeenCalledWith({ where: { email: 'bob@example.com' } })
    expect(tx.workspaceUser.createMany).toHaveBeenCalledWith({
      data: [
        { workspaceId: 5, userId: 20, role: 'editor', twoFactor: false },
        { workspaceId: 6, userId: 20, role: 'viewer', twoFactor: false },
      ],
    })
    expect(tx.workspaceInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } })
    expect(prisma.workspace.create).not.toHaveBeenCalled()
  })

  it('falls back to a workspace without a default table when nested create fails', async () => {
    ;(prisma.workspace.create as jest.Mock)
      .mockRejectedValueOnce(new Error('nested create failed'))
      .mockResolvedValueOnce({ id: 301 })

    const res = await register(valid)

    expect(res.status).toBe(201)
    expect(prisma.workspace.create).toHaveBeenCalledTimes(2)
    expect(prisma.workspaceUser.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: 301 }) })
  })

  it('returns the rate-limit response before reading the body', async () => {
    ;(applyRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({ error: 'too many' }, { status: 429 }))

    const res = await register(valid)

    expect(res.status).toBe(429)
    expect(applyRateLimit).toHaveBeenCalledWith('register:127.0.0.1', 5, 60)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })
})
