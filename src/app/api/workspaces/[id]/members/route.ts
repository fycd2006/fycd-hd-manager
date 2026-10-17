import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction, invalidateWorkspaceRoleCache } from '@/lib/authorize'

// GET /api/workspaces/[id]/members - Fetch members, invitations, and teams for a workspace
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })
    }

    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canViewData' })
    if (errorResponse) return errorResponse

    // 1. Parallelize fetching workspace members, invitations, and teams
    const [members, invitations, teams] = await Promise.all([
      prisma.workspaceUser.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: { id: true, username: true, email: true, role: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.workspaceInvitation.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.workspaceTeam.findMany({
        where: { workspaceId },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, username: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })
    ])

    return NextResponse.json({
      members: members.map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.user?.username || '未具名用戶',
        email: m.user?.email || '',
        role: m.role,
        twoFactor: m.twoFactor,
        createdAt: m.createdAt
      })),
      invitations,
      teams: teams.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description || '',
        memberCount: t.members.length,
        members: t.members.map(tm => ({ id: tm.user.id, name: tm.user.username, email: tm.user.email }))
      }))
    })
  } catch (error: any) {
    console.error('Fetch members failed:', error)
    return NextResponse.json({ error: error.message || '無法載入成員列表' }, { status: 500 })
  }
}

// POST /api/workspaces/[id]/members - Invite member or create team
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })
    }

    const { errorResponse, auth } = await authorizeAction({ workspaceId, action: 'canManageMembers' })
    if (errorResponse) return errorResponse
    const activeUser = auth!.user

    const body = await request.json()
    const { action, email, role, teamName, teamDescription } = body

    if (action === 'create_team') {
      if (!teamName || !teamName.trim()) {
        return NextResponse.json({ error: '團隊名稱不能為空' }, { status: 400 })
      }
      const newTeam = await prisma.workspaceTeam.create({
        data: {
          workspaceId,
          name: teamName.trim(),
          description: teamDescription?.trim() || null
        }
      })
      return NextResponse.json(newTeam, { status: 201 })
    }

    // Default: Invite by email
    if (!email || !email.trim()) {
      return NextResponse.json({ error: '電子郵件為必填欄位' }, { status: 400 })
    }

    const targetEmail = email.trim().toLowerCase()
    const inviteRole = role || 'member'

    // Check if user is already a member
    const existingUser = await prisma.user.findFirst({
      where: { email: targetEmail }
    })

    if (existingUser) {
      const existingMember = await prisma.workspaceUser.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } }
      })
      if (existingMember) {
        return NextResponse.json({ error: '該使用者已經是此工作區的成員' }, { status: 400 })
      }

      // Fetch workspace name
      const workspaceObj = await prisma.workspace.findUnique({ where: { id: workspaceId } })

      // Add directly to WorkspaceUser
      const newMember = await prisma.workspaceUser.create({
        data: {
          workspaceId,
          userId: existingUser.id,
          role: inviteRole
        },
        include: {
          user: { select: { id: true, username: true, email: true } }
        }
      })

      // Send in-app notification
      await prisma.notification.create({
        data: {
          userId: existingUser.id,
          type: 'workspace_invite',
          title: `已將您加入工作區：${workspaceObj?.name || '新工作區'}`,
          message: `${activeUser.username} 已將您新增至工作區「${workspaceObj?.name || '新工作區'}」，角色權限：${inviteRole}`,
          data: JSON.stringify({
            workspaceId,
            workspaceName: workspaceObj?.name,
            role: inviteRole
          })
        }
      })

      return NextResponse.json({
        message: '成員已成功新增至工作區並傳送站內通知',
        member: {
          id: newMember.id,
          userId: newMember.userId,
          name: newMember.user.username,
          email: newMember.user.email,
          role: newMember.role,
          twoFactor: newMember.twoFactor
        }
      }, { status: 201 })
    }

    // Create invitation record for email
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: targetEmail,
        role: inviteRole,
        invitedBy: activeUser.id
      }
    })

    return NextResponse.json({
      message: '邀請已成功寄出',
      invitation
    }, { status: 201 })

  } catch (error: any) {
    console.error('Invite/Team POST error:', error)
    return NextResponse.json({ error: error.message || '操作失敗' }, { status: 500 })
  }
}

// PATCH /api/workspaces/[id]/members - Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })
    }

    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canManageMembers' })
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 })
    }

    // Check if target user is workspace owner/creator (earliest member)
    const firstMember = await prisma.workspaceUser.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' }
    })

    if (firstMember && firstMember.userId === parseInt(userId)) {
      return NextResponse.json({ error: '工作區建立者之角色權限固定為系統管理員，無法變更' }, { status: 400 })
    }

    const updated = await prisma.workspaceUser.update({
      where: { workspaceId_userId: { workspaceId, userId: parseInt(userId) } },
      data: { role }
    })
    await invalidateWorkspaceRoleCache(workspaceId, parseInt(userId))

    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新角色失敗' }, { status: 500 })
  }
}

// DELETE /api/workspaces/[id]/members - Remove member or revoke invite
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) {
      return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })
    }

    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canManageMembers' })
    if (errorResponse) return errorResponse

    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const inviteId = url.searchParams.get('inviteId')
    const teamId = url.searchParams.get('teamId')

    if (userId) {
      const targetUserId = parseInt(userId)
      // Check if target user is workspace creator
      const firstMember = await prisma.workspaceUser.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' }
      })

      if (firstMember && firstMember.userId === targetUserId) {
        return NextResponse.json({ error: '無法將工作區建立者從工作區中移除' }, { status: 400 })
      }

      await prisma.workspaceUser.delete({
        where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
      })
      await invalidateWorkspaceRoleCache(workspaceId, targetUserId)
      return NextResponse.json({ message: '成員已從工作區移除' })
    }

    if (inviteId) {
      // Scope by workspaceId so an admin of one workspace cannot revoke another workspace's invites
      const { count } = await prisma.workspaceInvitation.deleteMany({
        where: { id: parseInt(inviteId), workspaceId }
      })
      if (count === 0) {
        return NextResponse.json({ error: '找不到邀請' }, { status: 404 })
      }
      return NextResponse.json({ message: '邀請已撤銷' })
    }

    if (teamId) {
      const { count } = await prisma.workspaceTeam.deleteMany({
        where: { id: parseInt(teamId), workspaceId }
      })
      if (count === 0) {
        return NextResponse.json({ error: '找不到團隊' }, { status: 404 })
      }
      return NextResponse.json({ message: '團隊已刪除' })
    }

    return NextResponse.json({ error: '缺少參數' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除失敗' }, { status: 500 })
  }
}
