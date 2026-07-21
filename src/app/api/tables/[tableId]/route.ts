import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    const body = await request.json()
    const updated = await prisma.databaseTable.update({
      where: { id },
      data: { ...(body.name && { name: body.name }), ...(body.order !== undefined && { order: body.order }) },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新資料表失敗' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })
    await prisma.databaseTable.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
    return NextResponse.json({ message: '資料表已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除資料表失敗' }, { status: 500 })
  }
}
