import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { ForgotPasswordSchema } from '@/lib/schemas/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`forgot-password:${ip}`, 5, 300)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const parseResult = ForgotPasswordSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || '請輸入有效的電子郵件地址'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { email } = parseResult.data
    const normalizedEmail = email.toLowerCase()

    // 1. Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { email }
        ]
      }
    })

    // To prevent User Enumeration attacks, always return success even if user not found
    if (!user) {
      return NextResponse.json({
        message: '若此電子郵件存在於系統中，重設密碼指示已發送。',
        success: true
      })
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

    // 4. Construct reset URL
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000'
    const baseUrl = origin.startsWith('http') ? origin : `http://${origin}`
    const resetUrl = `${baseUrl}/?resetToken=${resetToken}`

    console.log(`[AUTH] Password reset requested for ${user.email}. Reset Link: ${resetUrl}`)

    return NextResponse.json({
      message: '若此電子郵件存在於系統中，重設密碼指示已發送。',
      success: true,
      // In development mode, provide resetToken for ease of local testing
      ...(process.env.NODE_ENV !== 'production' ? { devResetUrl: resetUrl, devToken: resetToken } : {})
    })
  } catch (error: any) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: error?.message || '發送重設密碼請求失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
