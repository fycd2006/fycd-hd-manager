import crypto from 'crypto'
import { NextResponse } from 'next/server'
import * as argon2 from 'argon2'
import { POST } from '../route'
import prisma from '@/lib/prisma'
import { applyRateLimit } from '@/lib/rate-limiter'
import { createSessionToken } from '@/lib/auth'

const cookieSet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ set: cookieSet })),
}))

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn().mockResolvedValue('$argon2id$new-hash'),
}))

jest.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/auth', () => ({
  createSessionToken: jest.fn(() => 'signed-token'),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

const login = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  )

const user = (overrides: Record<string, unknown> = {}) => ({
  id: 7, username: 'alice', email: 'alice@example.com', role: 'member', password: '$argon2id$stored', ...overrides,
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(applyRateLimit as jest.Mock).mockResolvedValue(null)
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(user())
    ;(argon2.verify as jest.Mock).mockResolvedValue(true)
  })

  it('logs in with an argon2 password and sets an httpOnly session cookie', async () => {
    const res = await login({ username: 'alice', password: 'Secret123' })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user).toEqual({ id: 7, username: 'alice', email: 'alice@example.com', role: 'member' })
    expect(json.user).not.toHaveProperty('password')
    expect(createSessionToken).toHaveBeenCalledWith({ id: 7, username: 'alice', email: 'alice@example.com', role: 'member' })
    expect(cookieSet).toHaveBeenCalledWith('session', 'signed-token', expect.objectContaining({
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
    }))
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('looks the user up by username or lower-cased email', async () => {
    await login({ username: 'Alice@Example.com', password: 'x' })

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ username: 'Alice@Example.com' }, { email: 'alice@example.com' }, { email: 'Alice@Example.com' }] },
    })
  })

  it('rejects a wrong password with 401 and no cookie', async () => {
    ;(argon2.verify as jest.Mock).mockResolvedValue(false)

    const res = await login({ username: 'alice', password: 'wrong' })

    expect(res.status).toBe(401)
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('treats an argon2 verify exception as a wrong password', async () => {
    ;(argon2.verify as jest.Mock).mockRejectedValue(new Error('malformed hash'))

    const res = await login({ username: 'alice', password: 'x' })

    expect(res.status).toBe(401)
  })

  it('rejects an unknown user with 401', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await login({ username: 'ghost', password: 'x' })

    expect(res.status).toBe(401)
    expect(cookieSet).not.toHaveBeenCalled()
  })

  it('accepts a legacy SHA-256 hash and upgrades it to argon2', async () => {
    const sha = crypto.createHash('sha256').update('Legacy123').digest('hex')
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(user({ password: sha }))

    const res = await login({ username: 'alice', password: 'Legacy123' })

    expect(res.status).toBe(200)
    expect(argon2.verify).not.toHaveBeenCalled()
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { password: '$argon2id$new-hash' } })
  })

  it('does not upgrade the hash when a legacy password does not match', async () => {
    const sha = crypto.createHash('sha256').update('Legacy123').digest('hex')
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(user({ password: sha }))

    const res = await login({ username: 'alice', password: 'nope' })

    expect(res.status).toBe(401)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('still logs in when upgrading a legacy hash fails', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockResolvedValue(user({ password: 'plain-old' }))
    ;(prisma.user.update as jest.Mock).mockRejectedValue(new Error('db down'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await login({ username: 'alice', password: 'plain-old' })

    expect(res.status).toBe(200)
  })

  it('returns 400 when username or password is missing', async () => {
    const res = await login({ username: '', password: '' })

    expect(res.status).toBe(400)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('returns the rate-limit response keyed by the first forwarded IP', async () => {
    ;(applyRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({ error: 'too many' }, { status: 429 }))

    const res = await login({ username: 'alice', password: 'x' }, { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })

    expect(res.status).toBe(429)
    expect(applyRateLimit).toHaveBeenCalledWith('login:1.2.3.4', 10, 60)
    expect(prisma.user.findFirst).not.toHaveBeenCalled()
  })

  it('returns 500 when the database lookup throws', async () => {
    ;(prisma.user.findFirst as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED'))
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await login({ username: 'alice', password: 'x' })

    expect(res.status).toBe(500)
  })
})
