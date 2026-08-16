import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as argon2 from 'argon2'
import { ResetPasswordSchema } from '@/lib/schemas/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`reset-password:${ip}`, 5, 60)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const parseResult = ResetPasswordSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || '輸入資料無效'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { token, newPassword } = parseResult.data

    // 1. Find valid reset token
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { token }
    })

    if (!tokenRecord) {
      return NextResponse.json({ error: '重設密碼連結無效或已被使用，請重新申請' }, { status: 400 })
    }

    if (new Date() > tokenRecord.expiresAt) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({ where: { id: tokenRecord.id } }).catch(() => {})
      return NextResponse.json({ error: '重設密碼連結已過期，請重新申請' }, { status: 400 })
    }

    // 2. Find user
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: tokenRecord.email.toLowerCase() },
          { email: tokenRecord.email }
        ]
      }
    })

    if (!user) {
      return NextResponse.json({ error: '找不到對應的使用者帳號' }, { status: 404 })
    }

    // 3. Hash new password with Argon2
    const hashedPassword = await argon2.hash(newPassword)

    // 4. Update user password and remove all tokens for this email atomically
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      }),
      prisma.passwordResetToken.deleteMany({
        where: { email: tokenRecord.email }
      })
    ])

    return NextResponse.json({
      message: '密碼已成功重設，請使用新密碼登入',
      success: true
    })
  } catch (error: any) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: error?.message || '密碼重設失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
