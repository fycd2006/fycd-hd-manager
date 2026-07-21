import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cookies } from 'next/headers'

// Helper to authenticate user from session cookies
async function getSessionUser() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')
  if (!session?.value) return null

  try {
    const decoded = Buffer.from(session.value, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

// GET: 載入某一資料列下的所有留言
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const tid = parseInt(tableId)
    if (isNaN(tid)) return NextResponse.json({ error: '無效的 Table ID' }, { status: 400 })

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

    return NextResponse.json(comments)
  } catch (error: any) {
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

    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '未登入系統，無法留言' }, { status: 401 })
    }

    const body = await request.json()
    const { rowId, content } = body

    if (!rowId || !content || !content.trim()) {
      return NextResponse.json({ error: '缺少留言目標或內容為空' }, { status: 400 })
    }

    const rid = parseInt(rowId)
    if (isNaN(rid)) return NextResponse.json({ error: '無效的 Row ID' }, { status: 400 })

    const newComment = await prisma.rowComment.create({
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

    return NextResponse.json(newComment, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '發送留言失敗' }, { status: 500 })
  }
}
