import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withApiHandler } from '@/lib/api-handler'
import { getSessionUser } from '@/lib/auth'
import { createGeneratedColumn } from '@/modules/database/services/schemaService'
import { z } from 'zod'

const createFieldSchema = z.object({
  name: z.string().min(1, '欄位名稱為必填'),
  type: z.string().optional().default('text'),
  options: z.any().optional(),
  targetFieldId: z.union([z.number(), z.string()]).optional(),
  position: z.enum(['left', 'right']).optional(),
  isIndexed: z.boolean().optional(),
})

export const GET = withApiHandler<{ tableId: string }>(
  async ({ params }) => {
    const id = parseInt(params.tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const fields = await prisma.tableField.findMany({
      where: { tableId: id, deletedAt: null },
      orderBy: { order: 'asc' },
    })
    return fields
  },
  {
    auth: { action: 'canViewData' },
  }
)

export const POST = withApiHandler<{ tableId: string }, z.infer<typeof createFieldSchema>>(
  async ({ params, body }) => {
    const id = parseInt(params.tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { name, type = 'text', options, targetFieldId, position, isIndexed } = body!

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

    let parsedOptions = options ? (typeof options === 'object' ? options : JSON.parse(options)) : {}

    // Create the primary field
    const field = await prisma.tableField.create({
      data: {
        tableId: id,
        name,
        type: type || 'text',
        order: insertOrder,
        isIndexed: Boolean(isIndexed),
        options: parsedOptions ? (parsedOptions as any) : null,
      },
    })

    if (field.isIndexed) {
      await createGeneratedColumn(field.id).catch(err => console.error('[Schema DDL Error]', err))
    }

    // Audit fields backfill: populate existing rows with default user/date
    if (['created_by', 'last_modified_by', 'created_on', 'last_modified_on'].includes(type)) {
      try {
        const sessionUser = await getSessionUser()
        const currentUsername = sessionUser?.username || '系統 (System)'
        const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
        const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

        const existingRows = await prisma.tableRow.findMany({
          where: { tableId: id, deletedAt: null }
        })

        if (existingRows.length > 0) {
          const key = `field_${field.id}`
          await prisma.$transaction(async (tx) => {
            for (const r of existingRows) {
              let dataObj: Record<string, any> = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as any || {})
              if (!dataObj[key]) {
                if (type === 'created_by' || type === 'last_modified_by') {
                  dataObj[key] = currentUsername
                } else {
                  dataObj[key] = new Date(r.createdAt || Date.now()).toLocaleDateString('zh-TW', dateOpt) || nowStr
                }
              }
              await tx.tableRow.update({
                where: { id: r.id },
                data: { data: dataObj as any }
              })
            }
          })
        }
      } catch (err) {
        console.warn('[Audit Field Backfill Warning]:', err)
      }
    }

    // Bi-directional link_row handling: auto-create reverse field on target table
    if (type === 'link_row' && parsedOptions?.targetTableId && parsedOptions?.createRelatedField !== false) {
      try {
        const targetTableId = Number(parsedOptions.targetTableId)
        const sourceTable = await prisma.databaseTable.findUnique({ where: { id } })
        const targetTable = await prisma.databaseTable.findUnique({ where: { id: targetTableId } })

        if (sourceTable && targetTable) {
          const reverseFieldName = parsedOptions.relatedFieldName || `${sourceTable.name}`

          const existingTargetFields = await prisma.tableField.findMany({
            where: { tableId: targetTableId, deletedAt: null }
          })

          const reverseField = await prisma.tableField.create({
            data: {
              tableId: targetTableId,
              name: reverseFieldName,
              type: 'link_row',
              order: existingTargetFields.length,
              options: JSON.stringify({
                targetTableId: id,
                relatedFieldId: field.id,
                allowMultiple: parsedOptions.allowMultiple ?? true,
              })
            }
          })

          // Update original field with the reverse field ID
          parsedOptions.relatedFieldId = reverseField.id
          await prisma.tableField.update({
            where: { id: field.id },
            data: { options: JSON.stringify(parsedOptions) }
          })

          field.options = JSON.stringify(parsedOptions)
        }
      } catch (err) {
        console.warn('[Bi-directional Field Creation Warning]:', err)
      }
    }

    const allFields = [...existingFields]
    allFields.splice(insertOrder, 0, field)

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < allFields.length; i++) {
        const f = allFields[i]
        await tx.tableField.update({
          where: { id: f.id },
          data: { order: i },
        })
      }
    })

    return NextResponse.json({ ...field, order: insertOrder }, { status: 201 })
  },
  {
    auth: { action: 'canManageStructure' },
    bodySchema: createFieldSchema,
  }
)
