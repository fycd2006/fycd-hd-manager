import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { triggerTableEvent } from '@/lib/pusher-server'

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

    const body = await request.json()
    const rawList = body.rowIds || body.order || body.rows
    const socketId = body.socket_id

    if (!Array.isArray(rawList)) {
      return NextResponse.json({ error: '無效的排序格式' }, { status: 400 })
    }

    const rowIds: number[] = rawList
      .map((item: any) => (typeof item === 'number' ? item : item?.id))
      .filter((n: any) => typeof n === 'number' && !isNaN(n))

    // Safely update row orders in a transaction for existing rows
    const existingRows = await prisma.tableRow.findMany({
      where: { tableId: id, id: { in: rowIds } },
      select: { id: true },
    })
    const existingIdSet = new Set(existingRows.map(r => r.id))

    // Batch update using a single CASE/WHEN SQL statement (avoids transaction timeout)
    const validIds = rowIds.filter(rid => existingIdSet.has(rid))
    if (validIds.length > 0) {
      // Build CASE WHEN id=1 THEN 0 WHEN id=2 THEN 1 ... END
      const caseParts = validIds.map((rid, idx) => `WHEN ${rid} THEN ${idx}`).join(' ')
      const idList = validIds.join(',')
      await prisma.$executeRawUnsafe(
        `UPDATE TableRow SET \`order\` = CASE id ${caseParts} END WHERE id IN (${idList})`
      )
    }

    // Invalidate master view cache for this table
    await invalidateMasterViewCacheForTable(id)

    // Trigger realtime sync event
    triggerTableEvent(
      id,
      'rows-batch-changed',
      {
        type: 'reorder',
        timestamp: Date.now(),
      },
      socketId
    )

    return NextResponse.json({ success: true, message: '資料列順序更新成功' })
  } catch (error: any) {
    console.error('[API POST /api/tables/[tableId]/rows/reorder Error]:', error)
    return NextResponse.json({ error: error.message || '更新資料列順序失敗' }, { status: 500 })
  }
}
