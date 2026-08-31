import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
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
        options: sourceField.options as any,
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

    // 2. Duplicate cell content across all rows in table using chunked atomic SQL queries
    const targetRows = await prisma.tableRow.findMany({
      where: { tableId: tid, deletedAt: null },
      select: { id: true }
    })

    const srcPath = `$.field_${fid}`
    const newPath = `$.field_${newField.id}`
    const CHUNK_SIZE = 500

    for (let start = 0; start < targetRows.length; start += CHUNK_SIZE) {
      const chunk = targetRows.slice(start, start + CHUNK_SIZE)
      const chunkIds = chunk.map(r => r.id)

      await prisma.$executeRaw(
        Prisma.sql`UPDATE TableRow 
          SET data = JSON_SET(
            COALESCE(data, '{}'), 
            ${newPath}, 
            JSON_EXTRACT(data, ${srcPath})
          ) 
          WHERE id IN (${Prisma.join(chunkIds)}) 
            AND tableId = ${tid} 
            AND deletedAt IS NULL 
            AND JSON_CONTAINS_PATH(data, 'one', ${srcPath}) = 1`
      )
    }

    return NextResponse.json(newField, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '複製欄位失敗' }, { status: 500 })
  }
}
