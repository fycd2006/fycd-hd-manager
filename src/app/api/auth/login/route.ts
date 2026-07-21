import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: '帳號與密碼為必填' }, { status: 400 })
    }

    // 1. Find User by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }]
      }
    })
    if (!user) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }

    // 2. Hash and compare password
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')
    if (user.password !== hashedPassword) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }

    // 3. Create simple session payload
    const sessionData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }

    // Encrypt or just base64 format for simple cookie session
    const sessionString = Buffer.from(JSON.stringify(sessionData)).toString('base64')

    // 4. Set Session Cookie (Cookie expires in 7 days)
    const cookieStore = await cookies()
    cookieStore.set('session', sessionString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    return NextResponse.json({
      message: '登入成功',
      user: sessionData
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message || '伺服器資料庫連線失敗，請確認 DATABASE_URL 設定' }, { status: 500 })
  }
}
