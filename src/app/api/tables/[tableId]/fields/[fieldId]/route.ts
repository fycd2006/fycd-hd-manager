import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string; fieldId: string }> }
) {
  try {
    const { tableId, fieldId } = await params
    const tid = parseInt(tableId)
    const fid = parseInt(fieldId)
    if (isNaN(fid) || isNaN(tid)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canManageStructure' })
    if (errorResponse) return errorResponse

    const body = await request.json()
    const updated = await prisma.tableField.update({
      where: { id: fid },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.type && { type: body.type }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.options !== undefined && {
          options: body.options
            ? (typeof body.options === 'string' ? body.options : JSON.stringify(body.options))
            : null
        }),
      },
    })
    return NextResponse.json(updated)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '更新欄位失敗' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tableId: string; fieldId: string }> }
) {
  try {
    const { tableId, fieldId } = await params
    const tid = parseInt(tableId)
    const fid = parseInt(fieldId)
    if (isNaN(fid) || isNaN(tid)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canManageStructure' })
    if (errorResponse) return errorResponse

    await prisma.tableField.update({
      where: { id: fid },
      data: { deletedAt: new Date() }
    })
    return NextResponse.json({ message: '欄位已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除欄位失敗' }, { status: 500 })
  }
}
