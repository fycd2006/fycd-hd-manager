import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser, isAdmin } from '@/lib/auth'

// GET: 查詢使用者列表
export async function GET() {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權的存取' }, { status: 401 })
    }

    const isUserAdmin = await isAdmin()

    if (!isUserAdmin) {
      // 非管理員僅能取得基本資料 (用於選項清單等，不洩漏 email 與建立時間)
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          role: true
        },
        orderBy: { username: 'asc' }
      })
      return NextResponse.json(users)
    }

    // 管理員可取得包含 email、建立時間在內的完整資料
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json(users)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢用戶失敗' }, { status: 500 })
  }
}

// PATCH: 更新特定使用者角色 (僅限管理員)
export async function PATCH(request: Request) {
  try {
    const activeUser = await getSessionUser()
    const isUserAdmin = await isAdmin()
    if (!activeUser || !isUserAdmin) {
      return NextResponse.json({ error: '權限不足，必須為管理員' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body
    const uid = parseInt(userId)
    if (isNaN(uid)) return NextResponse.json({ error: '無效的用戶 ID' }, { status: 400 })

    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: '無效的角色類型' }, { status: 400 })
    }

    // 避免管理員自行降權
    if (uid === activeUser.id) {
      return NextResponse.json({ error: '不能修改您自己的角色' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id: uid },
      data: { role },
      select: { id: true, username: true, role: true }
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新角色失敗' }, { status: 500 })
  }
}

// DELETE: 刪除特定使用者 (僅限管理員)
export async function DELETE(request: Request) {
  try {
    const activeUser = await getSessionUser()
    const isUserAdmin = await isAdmin()
    if (!activeUser || !isUserAdmin) {
      return NextResponse.json({ error: '權限不足，必須為管理員' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userIdStr = searchParams.get('userId')
    if (!userIdStr) return NextResponse.json({ error: '缺少 userId 參數' }, { status: 400 })

    const uid = parseInt(userIdStr)
    if (isNaN(uid)) return NextResponse.json({ error: '無效的用戶 ID' }, { status: 400 })

    // 避免管理員自行刪除
    if (uid === activeUser.id) {
      return NextResponse.json({ error: '不能刪除您自己的帳號' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: uid }
    })

    return NextResponse.json({ message: '用戶已成功刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除用戶失敗' }, { status: 500 })
  }
}
