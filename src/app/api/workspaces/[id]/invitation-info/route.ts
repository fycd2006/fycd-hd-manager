import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

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

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        members: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: {
            user: {
              select: { username: true }
            }
          }
        }
      }
    })

    if (!workspace) {
      return NextResponse.json({ error: '找不到該工作區或連結已失效' }, { status: 404 })
    }

    const inviterName = workspace.members[0]?.user.username || '團隊管理員'

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      inviterName,
      createdAt: workspace.createdAt
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '無法載入邀請資訊' }, { status: 500 })
  }
}
