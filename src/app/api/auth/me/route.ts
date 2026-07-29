import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth'


export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user
    })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}


export async function POST() {
  try {
    const cookieStore = await cookies()
    // Clear session cookie
    cookieStore.set('session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/'
    })

    return NextResponse.json({ message: '已成功登出' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '登出失敗' }, { status: 500 })
  }
}
