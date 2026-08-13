import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// GET: list dynamic tables visible to the current user, with field/row counts.
// Admin sees everything; other users only see tables inside workspaces they
// belong to, plus legacy tables that are not attached to any database yet.
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const where = user.role === 'admin'
      ? {}
      : {
          OR: [
            { databaseId: null },
            { database: { workspace: { members: { some: { userId: user.id } } } } },
          ],
        }

    const tables = await prisma.databaseTable.findMany({
      where,
      include: {
        _count: { select: { fields: true, rows: true } },
      },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(tables)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢資料表失敗' }, { status: 500 })
  }
}

// POST: create a new table with a default 'Name' text field (legacy route,
// table is not attached to any database — prefer /api/workspaces create_table)
export async function POST(request: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: '未授權，請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body
    if (!name) return NextResponse.json({ error: '資料表名稱為必填' }, { status: 400 })

    const maxOrder = await prisma.databaseTable.aggregate({ _max: { order: true } })
    const newTable = await prisma.databaseTable.create({
      data: {
        name,
        order: (maxOrder._max.order ?? 0) + 1,
        fields: {
          create: [
            { name: '名稱', type: 'text', order: 0 },
          ],
        },
      },
      include: { fields: true, _count: { select: { fields: true, rows: true } } },
    })
    return NextResponse.json(newTable, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '建立資料表失敗' }, { status: 500 })
  }
}
