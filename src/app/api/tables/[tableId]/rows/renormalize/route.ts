import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { authorizeAction } from '@/lib/authorize'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    const id = parseInt(tableId)
    if (isNaN(id)) return NextResponse.json({ error: '無效的 ID' }, { status: 400 })

    const { errorResponse } = await authorizeAction({ tableId: id, action: 'canEditData' })
    if (errorResponse) return errorResponse

    const rows = await prisma.tableRow.findMany({
      where: { tableId: id },
      orderBy: { order: 'asc' },
      select: { id: true }
    })

    if (rows.length > 0) {
      const CHUNK_SIZE = 500
      await prisma.$transaction(async (tx) => {
        for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
          const chunk = rows.slice(start, start + CHUNK_SIZE)
          let sql = 'UPDATE TableRow SET `order` = CASE id '
          const params: any[] = []
          chunk.forEach((r, idx) => {
            sql += 'WHEN ? THEN ? '
            params.push(r.id, (start + idx + 1) * 1000)
          })
          sql += `ELSE \`order\` END WHERE id IN (${chunk.map(() => '?').join(', ')}) AND tableId = ?`
          params.push(...chunk.map(r => r.id), id)
          await tx.$executeRawUnsafe(sql, ...params)
        }
      }, {
        maxWait: 5000,
        timeout: 20000
      })
    }

    return NextResponse.json({ success: true, count: rows.length })
  } catch (error: any) {
    console.error('[API POST /api/tables/[tableId]/rows/renormalize Error]:', error)
    return NextResponse.json({ error: error.message || '重整排序失敗' }, { status: 500 })
  }
}
