import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// GET /api/notifications - Fetch active user notifications
export async function GET() {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ notifications: [] }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: activeUser.id },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ notifications })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '載入通知失敗' }, { status: 500 })
  }
}

// POST /api/notifications - Accept or Decline workspace invitation
export async function POST(request: Request) {
  try {
    const activeUser = await getSessionUser()
    if (!activeUser) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { notificationId, action } = body

    if (!notificationId || !action) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 })
    }

    const notification = await prisma.notification.findFirst({
      where: { id: parseInt(notificationId), userId: activeUser.id }
    })

    if (!notification) {
      return NextResponse.json({ error: '找不到通知訊息' }, { status: 404 })
    }

    if (notification.type === 'workspace_invite' && notification.data) {
      const inviteData = JSON.parse(notification.data)
      const { workspaceId, inviteId, role } = inviteData

      if (action === 'accept') {
        // Add to WorkspaceUser
        await prisma.workspaceUser.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: parseInt(workspaceId),
              userId: activeUser.id
            }
          },
          update: { role: role || 'member' },
          create: {
            workspaceId: parseInt(workspaceId),
            userId: activeUser.id,
            role: role || 'member'
          }
        })

        // Delete workspace invitation record if exists
        if (inviteId) {
          await prisma.workspaceInvitation.deleteMany({
            where: { id: parseInt(inviteId) }
          })
        }

        // Mark notification as read
        await prisma.notification.update({
          where: { id: notification.id },
          data: { read: true }
        })

        return NextResponse.json({ message: '已成功加入工作區！', workspaceId })
      } else if (action === 'decline') {
        if (inviteId) {
          await prisma.workspaceInvitation.deleteMany({
            where: { id: parseInt(inviteId) }
          })
        }
        await prisma.notification.update({
          where: { id: notification.id },
          data: { read: true }
        })

        return NextResponse.json({ message: '已拒絕工作區邀請' })
      }
    }

    // Mark as read default
    await prisma.notification.update({
      where: { id: notification.id },
      data: { read: true }
    })

    return NextResponse.json({ message: '操作完成' })
  } catch (error: any) {
    console.error('Notification action error:', error)
    return NextResponse.json({ error: error.message || '處理通知失敗' }, { status: 500 })
  }
}
