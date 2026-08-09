import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { cleanupFieldDependencies } from '@/modules/database/services/rowCascade'
import { createGeneratedColumn, dropGeneratedColumn } from '@/modules/database/services/schemaService'

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
    const oldField = await prisma.tableField.findUnique({ where: { id: fid } })

    const updated = await prisma.tableField.update({
      where: { id: fid },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.type && { type: body.type }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.isIndexed !== undefined && { isIndexed: body.isIndexed }),
        ...(body.options !== undefined && {
          options: body.options ? (body.options as any) : null
        }),
      },
    })

    if (oldField) {
      const isIndexed = body.isIndexed !== undefined ? body.isIndexed : oldField.isIndexed
      
      if (oldField.isIndexed !== isIndexed) {
        if (isIndexed) {
          await createGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        } else {
          await dropGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        }
      } else if (body.type && oldField.type !== body.type && isIndexed) {
        await dropGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        await createGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
      }
    }
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

    // Primary Field Lock Protection: Prevent deleting the first field (order min)
    const firstField = await prisma.tableField.findFirst({
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' }
    })
    if (firstField && firstField.id === fid) {
      return NextResponse.json({ error: '主要欄位（第一順位欄位）為系統核心欄位，禁止刪除' }, { status: 400 })
    }

    await prisma.tableField.update({
      where: { id: fid },
      data: { deletedAt: new Date() }
    })
    
    // Also drop index if it had one
    const oldField = await prisma.tableField.findUnique({ where: { id: fid } })
    if (oldField?.isIndexed) {
      await dropGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
    }
    
    await cleanupFieldDependencies(fid)
    return NextResponse.json({ message: '欄位已刪除' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '刪除欄位失敗' }, { status: 500 })
  }
}
