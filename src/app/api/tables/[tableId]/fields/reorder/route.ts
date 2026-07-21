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
    const { fieldOrders } = body // Expected format: { fieldOrders: { id: number, order: number }[] }
    if (!Array.isArray(fieldOrders)) {
      return NextResponse.json({ error: '無效的排序格式' }, { status: 400 })
    }

    // Batch update using transactions
    await prisma.$transaction(
      fieldOrders.map(fo =>
        prisma.tableField.update({
          where: { id: fo.id, tableId: id },
          data: { order: fo.order },
        })
      )
    )

    return NextResponse.json({ message: '欄位排序更新成功' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新欄位排序失敗' }, { status: 500 })
  }
}
