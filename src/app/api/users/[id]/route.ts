import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser, isAdmin } from '@/lib/auth'

// PATCH: 更新特定使用者 (僅限管理員)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await getSessionUser()
    const isUserAdmin = await isAdmin()
    if (!activeUser || !isUserAdmin) {
      return NextResponse.json({ error: '權限不足，必須為管理員' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    const body = await request.json()
    const { username, email, role } = body

    // 避免管理員自行降權
    if (userId === activeUser.id && role && role !== 'admin') {
      return NextResponse.json({ error: '不能修改您自己的管理員角色' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(username && { username }),
        ...(email && { email }),
        ...(role && { role }),
      },
      select: { id: true, username: true, email: true, role: true }
    })
    return NextResponse.json(updatedUser)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '使用者名稱或 Email 已存在' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || '更新使用者失敗' }, { status: 500 })
  }
}

// DELETE: 刪除特定使用者 (僅限管理員)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await getSessionUser()
    const isUserAdmin = await isAdmin()
    if (!activeUser || !isUserAdmin) {
      return NextResponse.json({ error: '權限不足，必須為管理員' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    }

    // 避免管理員刪除自己
    if (userId === activeUser.id) {
      return NextResponse.json({ error: '不能刪除您自己的帳號' }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: userId },
    })
    return NextResponse.json({ message: '使用者已成功刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除使用者失敗' }, { status: 500 })
  }
}
