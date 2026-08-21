import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'

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
      const existingTable = await prisma.databaseTable.findUnique({
        where: { id },
        select: { deletedAt: true },
      })
      const tableDeletedAt = existingTable?.deletedAt

      await prisma.$transaction([
        prisma.databaseTable.update({
          where: { id },
          data: {
            deletedAt: null,
            ...(body.name && { name: body.name }),
            ...(body.order !== undefined && { order: body.order }),
            ...(body.databaseId !== undefined && { databaseId: body.databaseId })
          },
        }),
        ...(tableDeletedAt
          ? [
              prisma.tableRow.updateMany({
                where: { tableId: id, deletedAt: tableDeletedAt },
                data: { deletedAt: null }
              }),
              prisma.tableField.updateMany({
                where: { tableId: id, deletedAt: tableDeletedAt },
                data: { deletedAt: null }
              })
            ]
          : [])
      ])

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
