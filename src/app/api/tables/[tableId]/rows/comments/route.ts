import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'

// GET: 載入某一資料列下的所有留言
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canComment' })
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const rowIdStr = searchParams.get('rowId')
    if (!rowIdStr) return NextResponse.json({ error: '缺少 rowId 參數' }, { status: 400 })

    const rid = parseInt(rowIdStr)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    const comments = await prisma.rowComment.findMany({
      where: { rowId: rid },
      include: {
        user: {
          select: {
            username: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    const hasHistory = comments.some(c => c.content.startsWith('[HISTORY]'))
    if (!hasHistory) {
      const rowMeta = await prisma.tableRow.findUnique({
        where: { id: rid },
        select: { createdAt: true, updatedAt: true }
      })
      if (rowMeta) {
        const creationHistory = {
          id: -999,
          rowId: rid,
          userId: 0,
          content: '[HISTORY] 建立了此資料列',
          createdAt: rowMeta.createdAt.toISOString(),
          user: { username: '系統 (System)', role: 'admin' }
        }
        return NextResponse.json([creationHistory, ...comments])
      }
    }

    return NextResponse.json(comments)
  } catch (error: any) {
    console.error('[API GET /api/tables/[tableId]/rows/comments Error]:', error)
    return NextResponse.json({ error: error.message || '載入留言失敗' }, { status: 500 })
  }
}

// POST: 發送新留言
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

    const { errorResponse, auth } = await authorizeAction({ tableId: tid, action: 'canComment' })
    if (errorResponse) return errorResponse

    const user = auth!.user

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: '無效的 JSON 請求內容' }, { status: 400 })
    }

    const { rowId, content } = body

    if (!rowId || !content || !content.trim()) {
      return NextResponse.json({ error: '缺少留言目標或內容為空' }, { status: 400 })
    }

    const rid = parseInt(rowId)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    // Single transaction: check row exists + create comment = 1 connection
    const newComment = await prisma.$transaction(async (tx) => {
      const targetRow = await tx.tableRow.findFirst({
        where: { id: rid, tableId: tid, deletedAt: null },
        select: { id: true }
      })
      if (!targetRow) {
        throw new Error('NOT_FOUND')
      }

      return tx.rowComment.create({
        data: {
          rowId: rid,
          userId: user.id,
          content: content.trim()
        },
        include: {
          user: {
            select: {
              username: true,
              role: true
            }
          }
        }
      })
    }, { maxWait: 5000, timeout: 10000 })

    return NextResponse.json(newComment, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到該資料列' }, { status: 404 })
    }
    console.error('[API POST /api/tables/[tableId]/rows/comments Error]:', error)
    return NextResponse.json({ error: error.message || '發送留言失敗' }, { status: 500 })
  }
}

