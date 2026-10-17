import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { invalidateWorkspaceRoleCache } from '@/lib/authorize'

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
      const { workspaceId, inviteId } = inviteData
      const wsId = parseInt(workspaceId)

      if ((action === 'accept' || action === 'decline') && notification.read) {
        return NextResponse.json({ error: '此通知已處理' }, { status: 409 })
      }

      if (action === 'accept') {
        // The notification payload is not authority: membership comes only from an existing
        // membership (left untouched) or a pending invitation addressed to this user.
        const existingMember = await prisma.workspaceUser.findUnique({
          where: { workspaceId_userId: { workspaceId: wsId, userId: activeUser.id } }
        })

        if (!existingMember) {
          const invitation = inviteId
            ? await prisma.workspaceInvitation.findFirst({
                where: { id: parseInt(inviteId), workspaceId: wsId, email: activeUser.email.toLowerCase() }
              })
            : null
          if (!invitation) {
            return NextResponse.json({ error: '邀請已失效，請聯絡工作區管理員' }, { status: 403 })
          }

          await prisma.workspaceUser.create({
            data: { workspaceId: wsId, userId: activeUser.id, role: invitation.role }
          })
          await prisma.workspaceInvitation.delete({ where: { id: invitation.id } })
          await invalidateWorkspaceRoleCache(wsId, activeUser.id)
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
            where: { id: parseInt(inviteId), email: activeUser.email.toLowerCase() }
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
