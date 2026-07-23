import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未登入，請先登入或註冊帳號' }, { status: 401 })
    }

    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })
    if (!workspace) {
      return NextResponse.json({ error: '找不到該工作區或已被刪除' }, { status: 404 })
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceUser.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: activeUser.id
        }
      }
    })

    if (existingMember) {
      return NextResponse.json({
        message: '您已經是此工作區的成員',
        workspaceId: workspace.id,
        workspaceName: workspace.name
      })
    }

    // Check if there is a pending invitation for this user's email to determine assigned role
    const pendingInvite = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email: activeUser.email.toLowerCase()
      }
    })

    const assignedRole = pendingInvite ? pendingInvite.role : 'editor'

    // Add user as workspace member
    await prisma.workspaceUser.create({
      data: {
        workspaceId,
        userId: activeUser.id,
        role: assignedRole,
        twoFactor: false
      }
    })

    // Clean up invitation if found
    if (pendingInvite) {
      await prisma.workspaceInvitation.delete({
        where: { id: pendingInvite.id }
      })
    }

    return NextResponse.json({
      message: `已成功加入工作區「${workspace.name}」`,
      workspaceId: workspace.id,
      workspaceName: workspace.name
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '加入工作區失敗' }, { status: 500 })
  }
}
