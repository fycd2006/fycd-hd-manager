import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import * as argon2 from 'argon2'
import { cookies } from 'next/headers'
import { createSessionToken } from '@/lib/auth'
import { LoginSchema } from '@/lib/schemas/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`login:${ip}`, 10, 60)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const parseResult = LoginSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || '輸入資料無效'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { username, password } = parseResult.data
    const normalizedInput = username
    const normalizedEmail = username.toLowerCase()



    // 1. Find User by username or email (case-insensitive fallback)

    const user = await prisma.user.findFirst({

      where: {

        OR: [

          { username: normalizedInput },

          { email: normalizedEmail },

          { email: normalizedInput }

        ]

      }

    })

    if (!user) {

      return NextResponse.json({ error: '帳號或密碼錯誤，請確認用戶名/Email是否正確' }, { status: 401 })

    }



    // 2. Compare password (Argon2, SHA-256 legacy hash, or plain text)
    let passwordMatch = false
    if (user.password.startsWith('$')) {
      try {
        passwordMatch = await argon2.verify(user.password, password)
      } catch {
        passwordMatch = false
      }
    } else if (user.password.length === 64) {
      // Legacy SHA-256 hex hash fallback
      const sha256Hash = crypto.createHash('sha256').update(password).digest('hex')
      passwordMatch = user.password.toLowerCase() === sha256Hash.toLowerCase()
    } else {
      // Legacy plain-text password fallback
      passwordMatch = user.password === password
    }

    if (passwordMatch && !user.password.startsWith('$argon2')) {
      // Upgrade legacy password hash/plain-text to Argon2 automatically
      try {
        const newHash = await argon2.hash(password)
        await prisma.user.update({
          where: { id: user.id },
          data: { password: newHash }
        })
      } catch (e) {
        console.warn('Failed to upgrade user password hash:', e)
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
    }



    // 3. Create session payload with HMAC signature

    const sessionData = {

      id: user.id,

      username: user.username,

      email: user.email,

      role: user.role

    }



    const sessionString = createSessionToken(sessionData)



    // 4. Set Session Cookie (Cookie expires in 7 days)
    const cookieStore = await cookies()
    cookieStore.set('session', sessionString, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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

