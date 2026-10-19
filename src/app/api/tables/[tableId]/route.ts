import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { restoreTable } from '@/modules/database/services/containerTrash'

export async function PATCH(
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

    // If restoring a soft-deleted table, restore ONLY child rows and fields that were deleted with the table
    if (body.deletedAt === null) {
      const restored = await restoreTable(id, {
        name: body.name,
        order: body.order,
        databaseId: body.databaseId,
      })
      if (!restored.ok) {
        return NextResponse.json({ error: restored.error }, { status: restored.status })
      }

      try {
        await invalidateMasterViewCacheForTable(id)
      } catch (cacheErr) {
        console.warn(`[MasterViewCache Warning on table restore]:`, cacheErr)
      }

      const updated = await prisma.databaseTable.findUnique({ where: { id } })
      return NextResponse.json(updated)
    }

    const updated = await prisma.databaseTable.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.databaseId !== undefined && { databaseId: body.databaseId })
      },
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

    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canManageStructure' })
    if (errorResponse) return errorResponse

    const now = new Date()
    await prisma.$transaction([
      prisma.databaseTable.update({
        where: { id },
        data: { deletedAt: now }
      }),
      prisma.tableRow.updateMany({
        where: { tableId: id, deletedAt: null },
        data: { deletedAt: now }
      }),
      prisma.tableField.updateMany({
        where: { tableId: id, deletedAt: null },
        data: { deletedAt: now }
      })
    ])

    try {
      await invalidateMasterViewCacheForTable(id)
    } catch (cacheErr) {
      console.warn(`[MasterViewCache Warning on table delete]:`, cacheErr)
    }

    return NextResponse.json({ message: '資料表已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除資料表失敗' }, { status: 500 })
  }
}
