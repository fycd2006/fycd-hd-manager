import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, email, password } = body

    if (!username || !email || !password) {
      return NextResponse.json({ error: '所有欄位均為必填' }, { status: 400 })
    }

    // 1. Check if user already exists
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }]
      }
    })
    if (existing) {
      return NextResponse.json({ error: '帳號或電子郵件已被註冊' }, { status: 400 })
    }

    // 2. Hash password with SHA-256
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex')

    // 3. Create User
    // If it is the first user, make them 'admin', otherwise 'member'
    const count = await prisma.user.count()
    const role = count === 0 ? 'admin' : 'member'

    const newUser = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role
      }
    })

    return NextResponse.json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '註冊失敗' }, { status: 500 })
  }
}
