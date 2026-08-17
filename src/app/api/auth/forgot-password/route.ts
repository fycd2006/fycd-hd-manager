import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { ForgotPasswordSchema } from '@/lib/schemas/auth'
import { applyRateLimit } from '@/lib/rate-limiter'
import { sendPasswordResetEmail } from '@/lib/email'


export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`forgot-password:${ip}`, 10, 300)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const parseResult = ForgotPasswordSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || '請輸入有效的帳號名稱與電子郵件'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { username, email } = parseResult.data
    const normalizedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()

    // 1. Check if user with matching username and email exists
    const user = await prisma.user.findFirst({
      where: {
        AND: [
          { username: normalizedUsername },
          {
            OR: [
              { email: normalizedEmail },
              { email: email.trim() }
            ]
          }
        ]
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: '帳號名稱與電子郵件不符或不存在，請確認後重試' },
        { status: 400 }
      )
    }

    // 2. Generate secure cryptographic token (32 bytes hex = 64 characters)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry

    // 3. Remove previous tokens for this email and save new token
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { email: user.email }
      }),
      prisma.passwordResetToken.create({
        data: {
          email: user.email,
          token: resetToken,
          expiresAt
        }
      })
    ])

    // 4. Optionally attempt background email if Resend is configured (does not block or fail reset flow)
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000'
    const baseUrl = origin.startsWith('http') ? origin : `http://${origin}`
    const resetUrl = `${baseUrl}/?resetToken=${resetToken}`
    sendPasswordResetEmail(user.email, resetUrl, user.username).catch(() => {})

    return NextResponse.json({
      message: '身分核對成功，請設定您的新密碼',
      success: true,
      resetToken
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: error?.message || '身分核對失敗，請稍後再試' },
      { status: 500 }
    )
  }
}

