import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { getSessionUser } from '@/lib/auth'

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

    let parsedOptions = options ? (typeof options === 'object' ? options : JSON.parse(options)) : {}

    // Create the primary field
    const field = await prisma.tableField.create({
      data: {
        tableId: id,
        name,
        type: type || 'text',
        order: insertOrder,
        options: parsedOptions ? JSON.stringify(parsedOptions) : null,
      },
    })

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
          const updates = existingRows.map(r => {
            let dataObj: Record<string, any> = {}
            try { dataObj = JSON.parse(r.data || '{}') } catch {}
            if (!dataObj[key]) {
              if (type === 'created_by' || type === 'last_modified_by') {
                dataObj[key] = currentUsername
              } else {
                dataObj[key] = new Date(r.createdAt || Date.now()).toLocaleDateString('zh-TW', dateOpt) || nowStr
              }
            }
            return prisma.tableRow.update({
              where: { id: r.id },
              data: { data: JSON.stringify(dataObj) }
            })
          })
          await prisma.$transaction(updates)
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

