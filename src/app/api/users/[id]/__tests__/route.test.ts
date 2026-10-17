import { PATCH, DELETE } from '../route'
import { getSessionUser, isAdmin } from '@/lib/auth'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
  isAdmin: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { update: jest.fn(), delete: jest.fn() },
  },
}))

const admin = { id: 1, username: 'root', email: 'root@example.com', role: 'admin' }
const member = { id: 2, username: 'bob', email: 'bob@example.com', role: 'member' }

const asUser = (user: typeof admin | null) => {
  ;(getSessionUser as jest.Mock).mockResolvedValue(user)
  ;(isAdmin as jest.Mock).mockResolvedValue(user?.role === 'admin')
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new Request(`http://localhost/api/users/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), ctx(id))
const del = (id: string) => DELETE(new Request(`http://localhost/api/users/${id}`, { method: 'DELETE' }), ctx(id))

beforeEach(() => {
  jest.clearAllMocks()
  asUser(admin)
  ;(prisma.user.update as jest.Mock).mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }))
})

describe('PATCH /api/users/[id]', () => {
  it('is admin-only', async () => {
    asUser(member)

    const res = await patch('3', { role: 'admin' })

    expect(res.status).toBe(403)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('updates only the provided fields', async () => {
    const res = await patch('3', { email: 'new@example.com' })

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { email: 'new@example.com' },
      select: { id: true, username: true, email: true, role: true },
    })
  })

  it('refuses to demote the caller but allows editing their own profile', async () => {
    expect((await patch('1', { role: 'member' })).status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()

    expect((await patch('1', { username: 'root2' })).status).toBe(200)
  })

  it('maps a unique constraint violation to 400', async () => {
    ;(prisma.user.update as jest.Mock).mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

    const res = await patch('3', { username: 'taken' })

    expect(res.status).toBe(400)
  })

  it('returns 400 for a non-numeric id', async () => {
    expect((await patch('abc', { username: 'x' })).status).toBe(400)
  })
})

describe('DELETE /api/users/[id]', () => {
  it('is admin-only', async () => {
    asUser(member)

    const res = await del('3')

    expect(res.status).toBe(403)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete the caller', async () => {
    const res = await del('1')

    expect(res.status).toBe(400)
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('deletes another user', async () => {
    const res = await del('3')

    expect(res.status).toBe(200)
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })
})
