import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const body = await request.json()
    const rawList = body.order || body.fieldOrders

    if (!Array.isArray(rawList)) {
      return NextResponse.json({ error: '無效的排序格式' }, { status: 400 })
    }

    const fieldIds: number[] = rawList.map((item: any) => typeof item === 'number' ? item : item.id)

    // Batch update using transaction
    await prisma.$transaction(
      fieldIds.map((fieldId, index) =>
        prisma.tableField.update({
          where: { id: fieldId, tableId: id },
          data: { order: index },
        })
      )
    )

    return NextResponse.json({ message: '欄位排序更新成功' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新欄位排序失敗' }, { status: 500 })
  }
}
