import { cookies } from 'next/headers'
import crypto from 'crypto'

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

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url')
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
    return JSON.parse(jsonStr) as SessionUser
  } catch {
    return null
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session?.value) return null

    return verifySessionToken(session.value)
  } catch {
    return null
  }
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser()
  return user?.role === 'admin'
}

