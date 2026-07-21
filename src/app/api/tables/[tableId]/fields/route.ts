import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(fields)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '查詢欄位失敗' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    const body = await request.json()
    const { name, type, options } = body
    if (!name) return NextResponse.json({ error: '欄位名稱為必填' }, { status: 400 })
    const maxOrder = await prisma.tableField.aggregate({ where: { tableId: id, deletedAt: null }, _max: { order: true } })
    const field = await prisma.tableField.create({
      data: {
        tableId: id,
        name,
        type: type || 'text',
        order: (maxOrder._max.order ?? 0) + 1,
        options: options ? JSON.stringify(options) : null,
      },
    })
    return NextResponse.json(field, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '新增欄位失敗' }, { status: 500 })
  }
}
