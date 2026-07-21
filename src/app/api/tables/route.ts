import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET: list all dynamic tables with field count
export async function GET() {
  try {
    const tables = await prisma.databaseTable.findMany({
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

// POST: create a new table with a default 'Name' text field
export async function POST(request: Request) {
  try {
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
