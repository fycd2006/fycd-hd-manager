import { GET, POST } from '../route'
import { getSessionUser } from '@/lib/auth'

const cookieSet = jest.fn()

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({ set: cookieSet })),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

describe('GET /api/auth/me', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the session user', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 7, username: 'alice' })

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ authenticated: true, user: { id: 7, username: 'alice' } })
  })

  it('returns 401 without a session', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ authenticated: false })
  })

  it('returns 401 when reading the session throws', async () => {
    ;(getSessionUser as jest.Mock).mockRejectedValue(new Error('bad signature'))

    const res = await GET()

    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/me (logout)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('clears the session cookie', async () => {
    const res = await POST()

    expect(res.status).toBe(200)
    expect(cookieSet).toHaveBeenCalledWith('session', '', expect.objectContaining({ httpOnly: true, maxAge: 0, path: '/' }))
  })
})
