import { cookies } from 'next/headers'

export interface SessionUser {
  id: number
  username: string
  email: string
  role: string
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session?.value) return null

    const decoded = Buffer.from(session.value, 'base64').toString('utf-8')
    return JSON.parse(decoded) as SessionUser
  } catch {
    return null
  }
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser()
  return user?.role === 'admin'
}
