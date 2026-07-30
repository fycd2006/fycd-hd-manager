import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'

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

    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canManageStructure' })
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { name, type, options, targetFieldId, position } = body
    if (!name) return NextResponse.json({ error: '欄位名稱為必填' }, { status: 400 })

    const existingFields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' },
    })

    let insertOrder = existingFields.length
    if (targetFieldId) {
      const idx = existingFields.findIndex(f => f.id === Number(targetFieldId))
      if (idx !== -1) {
        insertOrder = position === 'left' ? idx : idx + 1
      }
    }

    const field = await prisma.tableField.create({
      data: {
        tableId: id,
        name,
        type: type || 'text',
        order: insertOrder,
        options: options ? JSON.stringify(options) : null,
      },
    })

    const allFields = [...existingFields]
    allFields.splice(insertOrder, 0, field)

    await prisma.$transaction(
      allFields.map((f, i) =>
        prisma.tableField.update({
          where: { id: f.id },
          data: { order: i },
        })
      )
    )

    return NextResponse.json({ ...field, order: insertOrder }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '新增欄位失敗' }, { status: 500 })
  }
}
