import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler } from '@/lib/api-handler'
import { cleanupFieldDependencies } from '@/modules/database/services/rowCascade'
import { createGeneratedColumn, dropGeneratedColumn } from '@/modules/database/services/schemaService'
import { migrateSelectFieldsForTable } from '@/modules/database/services/selectFieldMigration'
import { authorizeAction } from '@/lib/authorize'
import { triggerTableEvent } from '@/lib/pusher-server'
import { z } from 'zod'

const updateFieldSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  order: z.number().optional(),
  isIndexed: z.boolean().optional(),
  options: z.any().optional(),
})

export const PATCH = withApiHandler<{ tableId: string; fieldId: string }, z.infer<typeof updateFieldSchema>>(
  async ({ request, params, body }) => {
    const tid = parseInt(params.tableId)
    const fid = parseInt(params.fieldId)
    if (isNaN(fid) || isNaN(tid)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const isOnlyOptionsUpdate = body!.options !== undefined && !body!.name && !body!.type && body!.order === undefined && body!.isIndexed === undefined
    const requiredAction = isOnlyOptionsUpdate ? 'canEditData' : 'canManageStructure'

    const { errorResponse } = await authorizeAction({ tableId: tid, action: requiredAction })
    if (errorResponse) return errorResponse

    const oldField = await prisma.tableField.findUnique({ where: { id: fid } })

    const updated = await prisma.tableField.update({
      where: { id: fid },
      data: {
        ...(body!.name && { name: body!.name }),
        ...(body!.type && { type: body!.type }),
        ...(body!.order !== undefined && { order: body!.order }),
        ...(body!.isIndexed !== undefined && { isIndexed: body!.isIndexed }),
        ...(body!.options !== undefined && {
          options: body!.options ? (body!.options as any) : null
        }),
      },
    })

    const currentType = updated.type || oldField?.type
    if ((body!.options !== undefined || body!.type !== undefined) && (currentType === 'single_select' || currentType === 'multiple_select')) {
      try {
        await migrateSelectFieldsForTable(tid, fid)
      } catch (migErr) {
        console.warn('[Select Field Migration Warning on Field Edit]:', migErr)
      }
    }

    if (oldField) {
      const isIndexed = body!.isIndexed !== undefined ? body!.isIndexed : oldField.isIndexed
      
      if (oldField.isIndexed !== isIndexed) {
        if (isIndexed) {
          await createGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        } else {
          await dropGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        }
      } else if (body!.type && oldField.type !== body!.type && isIndexed) {
        await dropGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
        await createGeneratedColumn(fid).catch(err => console.error('[Schema DDL Error]', err))
      }
    }
    const socketId = request.headers.get('x-socket-id') || (body as any)?.socket_id || undefined
    triggerTableEvent(tid, 'field-updated', { field: updated }, socketId)

    return updated
  },
  {
    bodySchema: updateFieldSchema,
  }
)

export const DELETE = withApiHandler<{ tableId: string; fieldId: string }>(
  async ({ request, params }) => {
    const tid = parseInt(params.tableId)
    const fid = parseInt(params.fieldId)
    if (isNaN(fid) || isNaN(tid)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

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

    const socketId = request.headers.get('x-socket-id') || undefined
    triggerTableEvent(tid, 'field-deleted', { fieldId: fid }, socketId)

    return { message: '欄位已刪除' }
  },
  {
    auth: { action: 'canManageStructure' },
  }
)
