import { GET, PATCH, DELETE } from '../route'
import { getSessionUser, isAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
  isAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
  },
}))

const admin = { id: 1, username: 'root', email: 'root@example.com', role: 'admin' }
const member = { id: 2, username: 'bob', email: 'bob@example.com', role: 'member' }

const asUser = (user: typeof admin | null) => {
  ;(getSessionUser as jest.Mock).mockResolvedValue(user)
  ;(isAdmin as jest.Mock).mockResolvedValue(user?.role === 'admin')
}

const patch = (body: unknown) =>
  PATCH(new Request('http://localhost/api/users', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
const del = (query: string) => DELETE(new Request(`http://localhost/api/users${query}`, { method: 'DELETE' }))

beforeEach(() => {
  jest.clearAllMocks()
  asUser(admin)
  ;(prisma.user.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/users', () => {
  it('returns 401 without a session', async () => {
    asUser(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('hides email and createdAt from non-admins', async () => {
    asUser(member)

    await GET()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: { id: true, username: true, role: true },
      orderBy: { username: 'asc' },
    })
  })

  it('returns full profiles to admins', async () => {
    await GET()

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      select: { id: true, username: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('PATCH /api/users', () => {
  it('is admin-only', async () => {
    asUser(member)

    const res = await patch({ userId: 3, role: 'admin' })

    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('only accepts admin or member roles', async () => {
    const res = await patch({ userId: 3, role: 'superuser' })

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('refuses to change the caller own role', async () => {
    const res = await patch({ userId: 1, role: 'member' })

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates another user role', async () => {
    ;(prisma.user.update as jest.Mock).mockResolvedValue({ id: 3, username: 'carol', role: 'admin' })

    const res = await patch({ userId: '3', role: 'admin' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 }, data: { role: 'admin' }, select: { id: true, username: true, role: true },
    })
  })

  it('returns 400 for a non-numeric user id', async () => {
    const res = await patch({ userId: 'x', role: 'admin' })

    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/users', () => {
  it('is admin-only', async () => {
    asUser(member)

    const res = await del('?userId=3')

    expect(res.status).toBe(403)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete the caller', async () => {
    const res = await del('?userId=1')

    expect(res.status).toBe(400)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('deletes another user', async () => {
    const res = await del('?userId=3')

    expect(res.status).toBe(200)
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })

  it('returns 400 for a missing or non-numeric user id', async () => {
    expect((await del('')).status).toBe(400)
    expect((await del('?userId=abc')).status).toBe(400)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })
})
