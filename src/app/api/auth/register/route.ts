import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, password } = body

    if (!username || !email || !password) {
      return NextResponse.json({ error: '所有欄位均為必填' }, { status: 400 })
    }

    const normalizedUsername = username.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (password.length < 6) {
      return NextResponse.json({ error: '密碼長度至少需要 6 個字元' }, { status: 400 })
    }

    // 1. Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { email: normalizedEmail }
        ]
      }
    })
    if (existing) {
      return NextResponse.json({ error: '帳號或電子郵件已被註冊' }, { status: 400 })
    }

    // 2. Hash password with SHA-256
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')

    // 3. Determine system role
    const totalUsers = await prisma.user.count()
    const systemRole = totalUsers === 0 ? 'admin' : 'member'

    // 4. Create User record
    const newUser = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        role: systemRole
      }
    })

    // 5. Check if there are pending invitations for this email
    const pendingInvitations = await prisma.workspaceInvitation.findMany({
      where: { email: normalizedEmail }
    })

    if (pendingInvitations.length > 0) {
      // Auto-accept all pending invitations for this email
      for (const invite of pendingInvitations) {
        await prisma.workspaceUser.create({
          data: {
            workspaceId: invite.workspaceId,
            userId: newUser.id,
            role: invite.role,
            twoFactor: false
          }
        })
        await prisma.workspaceInvitation.delete({
          where: { id: invite.id }
        })
      }
    } else {
      // Auto-create a default personal workspace for the user
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: `${normalizedUsername} 的工作區`,
          databases: {
            create: {
              name: '預設資料庫'
            }
          }
        }
      })

      // Link new user as Admin of their personal workspace
      await prisma.workspaceUser.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: newUser.id,
          role: 'admin',
          twoFactor: false
        }
      })
    }

    // 6. Automatically log in user by setting session cookie
    const userPayload = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    }
    const sessionToken = Buffer.from(JSON.stringify(userPayload)).toString('base64')

    const cookieStore = await cookies()
    cookieStore.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    return NextResponse.json({
      message: '註冊成功並已自動登入',
      user: userPayload
    }, { status: 201 })
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error?.message || '註冊失敗，請確認資料庫設定' },
      { status: 500 }
    )
  }
}
