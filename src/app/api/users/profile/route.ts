import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as argon2 from 'argon2'
import crypto from 'crypto'
import { cookies } from 'next/headers'
import { getSessionUser, createSessionToken } from '@/lib/auth'

export async function PATCH(request: Request) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { username, oldPassword, newPassword } = body

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id }
    })

    if (!user) {
      return NextResponse.json({ error: '找不到該使用者' }, { status: 404 })
    }

    const updates: Record<string, any> = {}

    // 1. Username update
    if (username && username.trim() !== '' && username.trim() !== user.username) {
      const trimmedUsername = username.trim()
      const existing = await prisma.user.findFirst({
        where: {
          username: trimmedUsername,
          NOT: { id: user.id }
        }
      })
      if (existing) {
        return NextResponse.json({ error: '該使用者名稱已被其他人使用' }, { status: 400 })
      }
      updates.username = trimmedUsername
    }

    // 2. Password update
    if (newPassword && newPassword.trim() !== '') {
      if (!oldPassword) {
        return NextResponse.json({ error: '請輸入舊密碼以確認身份' }, { status: 400 })
      }

      let passwordMatch = false
      if (user.password.startsWith('$')) {
        try {
          passwordMatch = await argon2.verify(user.password, oldPassword)
        } catch {
          passwordMatch = false
        }
      } else if (user.password.length === 64) {
        const sha256Hash = crypto.createHash('sha256').update(oldPassword).digest('hex')
        passwordMatch = user.password.toLowerCase() === sha256Hash.toLowerCase()
      } else {
        passwordMatch = user.password === oldPassword
      }

      if (!passwordMatch) {
        return NextResponse.json({ error: '舊密碼不正確' }, { status: 400 })
      }

      updates.password = await argon2.hash(newPassword)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: '無資料需要更新', user: sessionUser })
    }

    // Perform database update
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      select: { id: true, username: true, email: true, role: true }
    })

    // Update Session Cookie so the session reflects new username immediately
    const newSessionUser = {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      role: updated.role
    }

    const cookieStore = await cookies()
    cookieStore.set('session', createSessionToken(newSessionUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    return NextResponse.json({ ok: true, user: newSessionUser })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '使用者名稱已被使用' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || '更新失敗' }, { status: 500 })
  }
}
