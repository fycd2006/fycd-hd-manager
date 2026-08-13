import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'

export const dynamic = 'force-dynamic'

/**
 * POST: Enable (or retrieve) the public share link for this table's form view.
 * Creates a form view if none exists, and generates a share token if missing.
 * Requires canManageViews permission.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canManageViews' })
    if (errorResponse) return errorResponse

    const dbTable = await prisma.databaseTable.findFirst({
      where: { id: tid, deletedAt: null }
    })
    if (!dbTable) {
      return NextResponse.json({ error: '找不到該資料表' }, { status: 404 })
    }

    // Find or create the form view for this table
    let formView = await prisma.tableView.findFirst({
      where: { tableId: tid, type: 'form' },
      orderBy: { createdAt: 'asc' }
    })
    if (!formView) {
      formView = await prisma.tableView.create({
        data: { tableId: tid, name: '表單視圖', type: 'form' }
      })
    }

    // Generate a share token if the view does not have one yet
    let token = formView.shareToken
    if (!token) {
      token = crypto.randomBytes(24).toString('base64url')
      formView = await prisma.tableView.update({
        where: { id: formView.id },
        data: { shareToken: token }
      })
    }

    return NextResponse.json({
      token,
      shareUrl: `/form/${token}`,
      viewId: formView.id
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '建立表單分享連結失敗' }, { status: 500 })
  }
}

/**
 * DELETE: Revoke the public share link(s) of this table's form views.
 * Requires canManageViews permission.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canManageViews' })
    if (errorResponse) return errorResponse

    await prisma.tableView.updateMany({
      where: { tableId: tid, type: 'form', NOT: { shareToken: null } },
      data: { shareToken: null }
    })

    return NextResponse.json({ message: '表單分享連結已停用' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '停用表單分享連結失敗' }, { status: 500 })
  }
}
