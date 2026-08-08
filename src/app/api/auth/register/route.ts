import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as argon2 from 'argon2'
import { cookies } from 'next/headers'
import { createSessionToken } from '@/lib/auth'
import { RegisterSchema } from '@/lib/schemas/auth'
import { applyRateLimit } from '@/lib/rate-limiter'

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateLimitError = await applyRateLimit(`register:${ip}`, 5, 60)
    if (rateLimitError) return rateLimitError

    const body = await request.json()
    const parseResult = RegisterSchema.safeParse(body)

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || '輸入資料無效'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { username, email, password } = parseResult.data
    const normalizedUsername = username
    const normalizedEmail = email.toLowerCase()

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

    // 2. Hash password with Argon2
    const hashedPassword = await argon2.hash(password)

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
      // Auto-accept all pending invitations for this email in an atomic transaction
      await prisma.$transaction(async (tx) => {
        await tx.workspaceUser.createMany({
          data: pendingInvitations.map((invite) => ({
            workspaceId: invite.workspaceId,
            userId: newUser.id,
            role: invite.role,
            twoFactor: false
          }))
        })
        await tx.workspaceInvitation.deleteMany({
          where: { id: { in: pendingInvitations.map((invite) => invite.id) } }
        })
      })
    } else {
      // Auto-create a default personal workspace with a default table for the user
      let newWorkspace
      try {
        newWorkspace = await prisma.workspace.create({
          data: {
            name: `${normalizedUsername} 的工作區`,
            databases: {
              create: {
                name: '預設資料庫',
                tables: {
                  create: {
                    name: '資料表 1',
                    order: 0,
                    fields: {
                      create: [
                        { name: '名稱', type: 'text', order: 0 }
                      ]
                    }
                  }
                }
              }
            }
          }
        })
      } catch {
        newWorkspace = await prisma.workspace.create({
          data: {
            name: `${normalizedUsername} 的工作區`,
            databases: {
              create: {
                name: '預設資料庫'
              }
            }
          }
        })
      }

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
    const sessionToken = createSessionToken(userPayload)

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
