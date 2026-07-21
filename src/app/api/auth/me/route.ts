import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('session')
    if (!session?.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Decode session payload
    const decoded = Buffer.from(session.value, 'base64').toString('utf-8')
    const user = JSON.parse(decoded)

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
