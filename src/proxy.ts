import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/session-token'

/**
 * Global login gate for API routes (Next.js 16 "proxy", formerly middleware).
 *
 * Coarse-grained check: every /api/* request must carry a valid, unexpired
 * session cookie — except the explicitly public paths below. Fine-grained
 * workspace/role authorization still happens per-route via authorizeAction.
 *
 * Runs in the Node.js runtime by default (Next 16), so node:crypto is fine.
 */

// Exact paths reachable without a session
const PUBLIC_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/register',
  // /api/auth/me performs its own session check and doubles as the logout
  // endpoint (POST clears the cookie), so it must stay reachable
  '/api/auth/me',
])

// Prefixes reachable without a session
const PUBLIC_PREFIXES = [
  '/api/form/', // public shared forms (capability token in the URL)
  '/api/cron/', // has its own CRON_SECRET bearer check (fail-closed)
]

// Invite preview for users who have not logged in yet
const PUBLIC_PATTERNS = [
  /^\/api\/workspaces\/\d+\/invitation-info\/?$/,
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATTERNS.some((re) => re.test(pathname))
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get('session')?.value
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
