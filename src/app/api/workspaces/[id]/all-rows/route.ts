import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'
import { getMultiTableRows } from '@/modules/database/services/multiTableQuery'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Batch-fetches all authorized table IDs within a workspace in a single query.
 *
 * Auth model rationale: permissions are workspace-level (WorkspaceUser role),
 * not table-level. Once the caller passes `authorizeAction({ workspaceId })`,
 * every non-deleted table under that workspace is accessible.
 * The only tables we must exclude are:
 *   1. Soft-deleted tables (deletedAt IS NOT NULL)
 *   2. Orphan tables not linked to any Database (databaseId IS NULL)
 *      — these predate the workspace model and are handled separately.
 *
 * This replaces the prior N+1 loop that called authorizeAction per table.
 */
export async function getAuthorizedTableIds(workspaceId: number): Promise<number[]> {
  const tables = await prisma.databaseTable.findMany({
    where: {
      deletedAt: null,
      database: { workspaceId }
    },
    select: { id: true }
  })
  return tables.map(t => t.id)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceId = parseInt(id)
    if (isNaN(workspaceId)) return NextResponse.json({ error: '無效的工作區 ID' }, { status: 400 })

    // Single workspace-level auth check — covers all child tables
    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canViewData' })
    if (errorResponse) return errorResponse

    // Batch query: one round-trip to get all authorized table IDs
    const authorizedTableIds = await getAuthorizedTableIds(workspaceId)

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
    const isDev = process.env.NODE_ENV === 'development'
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[API GET /api/workspaces/[id]/all-rows Error]:', error)
    return NextResponse.json(
      { error: isDev ? (msg || '查詢多表資料列失敗') : '查詢多表資料列失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
