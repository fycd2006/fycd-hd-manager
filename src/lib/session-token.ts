import crypto from 'crypto'

/**
 * Pure session-token signing/verification (no next/headers dependency).
 * Kept separate from auth.ts so it can also be imported by src/proxy.ts,
 * which runs before route handlers.
 */

export interface SessionUser {
  id: number
  username: string
  email: string
  role: string
  language?: string
}

const SESSION_SECRET = process.env.SESSION_SECRET

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production and must be at least 32 characters long.')
  } else {
    console.warn('[SECURITY WARNING] SESSION_SECRET environment variable is not set or less than 32 characters.')
  }
}

const EFFECTIVE_SECRET = SESSION_SECRET || 'fycd-hd-manager-default-secret-key-at-least-32-chars-long'

// Session token lifetime: 7 days (matches the login cookie maxAge).
// Tokens older than this are rejected even if the HMAC signature is valid.
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

interface SessionPayload extends SessionUser {
  exp: number // expiry timestamp in ms (epoch)
}

export function createSessionToken(user: SessionUser): string {
  const payloadObj: SessionPayload = { ...user, exp: Date.now() + SESSION_MAX_AGE_MS }
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const hmac = crypto.createHmac('sha256', EFFECTIVE_SECRET).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 2) {
      return null
    }

    const [payload, signature] = parts
    const expectedHmac = crypto.createHmac('sha256', EFFECTIVE_SECRET).update(payload).digest('base64url')

    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedHmac)

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }

    const jsonStr = Buffer.from(payload, 'base64url').toString('utf-8')
    const parsed = JSON.parse(jsonStr) as Partial<SessionPayload>

    // Reject tokens without an expiry claim (legacy) or already expired
    if (typeof parsed.exp !== 'number' || parsed.exp <= Date.now()) {
      return null
    }

    return {
      id: parsed.id as number,
      username: parsed.username as string,
      email: parsed.email as string,
      role: parsed.role as string,
      language: parsed.language,
    }
  } catch {
    return null
  }
}
