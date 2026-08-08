import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string; fieldId: string }> }
) {
  try {
    const { tableId, fieldId } = await params
    const tid = parseInt(tableId)
    const fid = parseInt(fieldId)
    if (isNaN(tid) || isNaN(fid)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: tid, action: 'canManageStructure' })
    if (errorResponse) return errorResponse

    const sourceField = await prisma.tableField.findUnique({
      where: { id: fid, tableId: tid }
    })
    if (!sourceField) return NextResponse.json({ error: '找不到原始欄位' }, { status: 404 })

    const existingFields = await prisma.tableField.findMany({
      where: { tableId: tid, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const sourceIndex = existingFields.findIndex(f => f.id === fid)
    const insertOrder = sourceIndex !== -1 ? sourceIndex + 1 : existingFields.length

    // 1. Create duplicate field schema right after source field
    const newField = await prisma.tableField.create({
      data: {
        tableId: tid,
        name: `${sourceField.name} (Copy)`,
        type: sourceField.type,
        order: insertOrder,
        options: sourceField.options,
      }
    })

    // Re-index all fields
    const allFields = [...existingFields]
    allFields.splice(insertOrder, 0, newField)

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < allFields.length; i++) {
        const f = allFields[i]
        await tx.tableField.update({
          where: { id: f.id },
          data: { order: i }
        })
      }
    })

    // 2. Duplicate cell content across all rows in table
    const rows = await prisma.tableRow.findMany({
      where: { tableId: tid, deletedAt: null }
    })

    const srcKey = `field_${fid}`
    const newKey = `field_${newField.id}`

    if (rows.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const r of rows) {
          let dataObj: Record<string, any> = {}
          try {
            dataObj = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {})
          } catch {}

          dataObj[newKey] = dataObj[srcKey] !== undefined ? dataObj[srcKey] : null

          await tx.tableRow.update({
            where: { id: r.id },
            data: { data: JSON.stringify(dataObj) }
          })
        }
      })
    }

    return NextResponse.json(newField, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '複製欄位失敗' }, { status: 500 })
  }
}
