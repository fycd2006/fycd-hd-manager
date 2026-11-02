import { GET } from '../route'
import { proxy } from '@/proxy'
import { NextRequest } from 'next/server'
import { APP_CURRENT_VERSION, CHANGELOG_RELEASES } from '@/config/changelog'

describe('GET /api/version', () => {
  it('returns current version and changelog releases with no-cache headers', async () => {
    const req = new Request('http://localhost:3000/api/version')
    const res = await GET(req, { params: Promise.resolve({}) })

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')

    const data = await res.json()
    expect(data.version).toBe(APP_CURRENT_VERSION)
    expect(data.latestRelease.version).toBe(APP_CURRENT_VERSION)
    expect(data.history).toEqual(CHANGELOG_RELEASES)
  })

  it('allows unauthenticated requests through proxy for /api/version', () => {
    const req = new NextRequest('http://localhost:3000/api/version')
    const res = proxy(req)

    // Should not return 401 unauthenticated
    expect(res.status).not.toBe(401)
  })
})
