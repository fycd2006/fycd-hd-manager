import * as argon2 from 'argon2'
import { POST } from '../route'
import prisma from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rate-limiter'

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('$argon2id$new'),
}))

jest.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    passwordResetToken: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn((args) => ({ op: 'deleteTokens', args })),
    },
    user: {
      findFirst: jest.fn(),
      update: jest.fn((args) => ({ op: 'updateUser', args })),
    },
    $transaction: jest.fn(),
  },
}))

const reset = (body: unknown) =>
  POST(
    new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )

const future = () => new Date(Date.now() + 10 * 60 * 1000)

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(applyRateLimit as jest.Mock).mockResolvedValue(null)
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: 1, email: 'alice@example.com', token: 'tok', expiresAt: future(),
    })
    ;(prisma.passwordResetToken.delete as jest.Mock).mockResolvedValue({})
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 7, email: 'alice@example.com' })
    ;(prisma.$transaction as jest.Mock).mockResolvedValue([])
  })

  it('hashes the new password and atomically updates it while consuming every token for that email', async () => {
    const res = await reset({ token: 'tok', newPassword: 'NewPass123' })

    expect(res.status).toBe(200)
    expect(argon2.hash).toHaveBeenCalledWith('NewPass123')
    expect(prisma.$transaction).toHaveBeenCalledWith([
      { op: 'updateUser', args: { where: { id: 7 }, data: { password: '$argon2id$new' } } },
      { op: 'deleteTokens', args: { where: { email: 'alice@example.com' } } },
    ])
  })

  it('rejects an unknown token with 400', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await reset({ token: 'nope', newPassword: 'NewPass123' })

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects and deletes an expired token', async () => {
    ;(prisma.passwordResetToken.findUnique as jest.Mock).mockResolvedValue({
      id: 1, email: 'alice@example.com', token: 'tok', expiresAt: new Date(Date.now() - 1000),
    })

    const res = await reset({ token: 'tok', newPassword: 'NewPass123' })

    expect(res.status).toBe(400)
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('returns 404 when the token email no longer has a user', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await reset({ token: 'tok', newPassword: 'NewPass123' })

    expect(res.status).toBe(404)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('enforces the password policy before touching the token', async () => {
    const res = await reset({ token: 'tok', newPassword: 'weak' })

    expect(res.status).toBe(400)
    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled()
  })

  it('is rate limited per IP', async () => {
    await reset({ token: 'tok', newPassword: 'NewPass123' })

    expect(applyRateLimit).toHaveBeenCalledWith('reset-password:127.0.0.1', 5, 60)
  })
})
