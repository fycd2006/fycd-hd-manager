import { cookies } from 'next/headers'
import { verifySessionToken, SessionUser } from './session-token'

// Re-export so existing imports from '@/lib/auth' keep working
export { createSessionToken, verifySessionToken } from './session-token'
export type { SessionUser } from './session-token'

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
