import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'
import { getMultiTableRows } from '@/modules/database/services/multiTableQuery'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })

    // Check workspace authorization
    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canViewData' })
    if (errorResponse) return errorResponse

    // Get all table IDs in this workspace
    const databases = await prisma.database.findMany({
      where: { workspaceId },
      include: { tables: { select: { id: true } } }
    })
    const rawTableIds = databases.flatMap(db => db.tables.map(t => t.id))

    if (rawTableIds.length === 0) {
      return NextResponse.json({ rows: [], nextCursor: null })
    }

    // Phase 0 Requirement: Pre-filter authorized child tables before cross-table query
    const authorizedTableIds: number[] = []
    for (const tid of rawTableIds) {
      const { errorResponse: tableErr } = await authorizeAction({ tableId: tid, action: 'canViewData' })
      if (!tableErr) {
        authorizedTableIds.push(tid)
      }
    }

    if (authorizedTableIds.length === 0) {
      return NextResponse.json({ rows: [], nextCursor: null })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 50

    const result = await getMultiTableRows({ tableIds: authorizedTableIds, cursor, limit })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API GET /api/workspaces/[id]/all-rows Error]:', error)
    return NextResponse.json({ error: msg || '查詢多表資料列失敗' }, { status: 500 })
  }
}
