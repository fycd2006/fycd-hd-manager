import crypto from 'crypto'
import * as argon2 from 'argon2'
import { PATCH } from '../route'
import { getSessionUser, createSessionToken } from '@/lib/auth'
import prisma from '@/lib/prisma'

const cookieSet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ set: cookieSet })),
}))

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('$argon2id$new'),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
  createSessionToken: jest.fn(() => 'refreshed-token'),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  },
}))

const session = { id: 2, username: 'bob', email: 'bob@example.com', role: 'member' }

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api/users/profile', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

describe('PATCH /api/users/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getSessionUser as jest.Mock).mockResolvedValue(session)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...session, password: '$argon2id$old' })
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.update as jest.Mock).mockImplementation(async ({ data }) => ({ ...session, ...data, password: undefined }))
    ;(argon2.verify as jest.Mock).mockResolvedValue(true)
  })

  it('requires login', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await patch({ username: 'x' })

    expect(res.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('only ever updates the session user', async () => {
    await patch({ username: 'bobby', id: 99 })

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 2 } })
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 2 } }))
  })

  it('renames the user and refreshes the session cookie', async () => {
    const res = await patch({ username: '  bobby ' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 2 }, data: { username: 'bobby' }, select: { id: true, username: true, email: true, role: true },
    })
    expect(createSessionToken).toHaveBeenCalledWith({ id: 2, username: 'bobby', email: 'bob@example.com', role: 'member' })
    expect(cookieSet).toHaveBeenCalledWith('session', 'refreshed-token', expect.objectContaining({ httpOnly: true }))
  })

  it('rejects a username that someone else already uses', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 3 })

    const res = await patch({ username: 'carol' })

    expect(res.status).toBe(400)
    expect(prisma.user.findFirst).toHaveBeenCalledWith({ where: { username: 'carol', NOT: { id: 2 } } })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('requires the old password before changing the password', async () => {
    const res = await patch({ newPassword: 'NewPass123' })

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a wrong old password', async () => {
    ;(argon2.verify as jest.Mock).mockResolvedValue(false)

    const res = await patch({ oldPassword: 'nope', newPassword: 'NewPass123' })

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('stores the new password as an argon2 hash', async () => {
    const res = await patch({ oldPassword: 'OldPass123', newPassword: 'NewPass123' })

    expect(res.status).toBe(200)
    expect(argon2.verify).toHaveBeenCalledWith('$argon2id$old', 'OldPass123')
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { password: '$argon2id$new' } }))
  })

  it('verifies a legacy SHA-256 old password', async () => {
    const sha = crypto.createHash('sha256').update('OldPass123').digest('hex')
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...session, password: sha })

    const res = await patch({ oldPassword: 'OldPass123', newPassword: 'NewPass123' })

    expect(res.status).toBe(200)
    expect(argon2.verify).not.toHaveBeenCalled()
  })

  it('does nothing when there is nothing to change', async () => {
    const res = await patch({ username: 'bob' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).not.toHaveBeenCalled()
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('returns 404 when the session user no longer exists', async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await patch({ username: 'x' })

    expect(res.status).toBe(404)
  })
})
