import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeAction } from '@/lib/authorize'
import { getMultiTableRows, getAuthorizedTableIds } from '@/modules/database/services/multiTableQuery'
import { mergeMasterViewOverrides } from '@/modules/database/services/masterViewOverride'
import {
  getMasterViewCacheKey,
  getCachedMasterViewRows,
  setCachedMasterViewRows,
} from '@/modules/database/services/masterViewCache'

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

    // Single workspace-level auth check — covers all child tables
    const { errorResponse } = await authorizeAction({ workspaceId, action: 'canViewData' })
    if (errorResponse) return errorResponse

    // Batch query: one round-trip to get all authorized table IDs
    const authorizedTableIds = await getAuthorizedTableIds(workspaceId)

    // Query total tables count in workspace to evaluate hidden/unauthorized tables count
    const totalTablesCount = await prisma.databaseTable.count({
      where: {
        deletedAt: null,
        database: { workspaceId },
      },
    })
    const authorizedTablesCount = authorizedTableIds.length
    const hiddenTablesCount = Math.max(0, totalTablesCount - authorizedTablesCount)
    const permissionInfo = {
      totalTablesCount,
      authorizedTablesCount,
      hiddenTablesCount,
    }

    if (authorizedTableIds.length === 0) {
      return NextResponse.json({ rows: [], nextCursor: null, fieldsMap: {}, permissionInfo })
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam) : 50
    const masterViewIdParam = searchParams.get('masterViewId')
    const masterViewId = masterViewIdParam ? parseInt(masterViewIdParam) : null
    const sortField = searchParams.get('sortField') || undefined
    const sortOrderParam = searchParams.get('sortOrder')
    const sortOrder = sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : undefined
    const filtersParam = searchParams.get('filters')
    let filters: any[] | undefined = undefined
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          filters = parsedFilters.filter(f => f && typeof f === 'object' && f.field && f.operator)
        }
      } catch {}
    }

    const tableIdsParam = searchParams.get('tableIds')
    let targetTableIds = authorizedTableIds
    let requestedTableIds: number[] | null = null
    if (tableIdsParam) {
      const parsedIds = tableIdsParam
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id) && authorizedTableIds.includes(id))
      if (parsedIds.length > 0) {
        targetTableIds = parsedIds
        requestedTableIds = parsedIds
      }
    }

    // Query total row counts per table across authorized tables in database
    const tableCountsGroup = await prisma.tableRow.groupBy({
      by: ['tableId'],
      where: {
        tableId: { in: authorizedTableIds },
        deletedAt: null,
      },
      _count: {
        id: true,
      },
    })
    const tableCounts: Record<number, number> = {}
    let totalRowsCount = 0
    tableCountsGroup.forEach((g) => {
      tableCounts[g.tableId] = g._count.id
      totalRowsCount += g._count.id
    })

    // Check Short-TTL Cache
    const cacheKey = getMasterViewCacheKey(workspaceId, masterViewId, {
      cursor,
      limit,
      sortField,
      sortOrder,
      filters,
      tableIds: requestedTableIds,
    })

    const cached = await getCachedMasterViewRows(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const tableFields = await prisma.tableField.findMany({
      where: {
        tableId: { in: authorizedTableIds },
        deletedAt: null,
      },
      select: {
        id: true,
        tableId: true,
        name: true,
        type: true,
        options: true,
      },
    })

    const fieldsMap: Record<string, { id: number; tableId: number; name: string; type: string; options?: any }> = {}
    const fieldMapByTable: Record<number, Record<string, string>> = {}

    tableFields.forEach((f) => {
      const fieldEntry = {
        id: f.id,
        tableId: f.tableId,
        name: f.name,
        type: f.type,
        options: f.options,
      }
      fieldsMap[`field_${f.id}`] = fieldEntry
      fieldsMap[String(f.id)] = fieldEntry

      if (!fieldMapByTable[f.tableId]) {
        fieldMapByTable[f.tableId] = {}
      }
      const trimmedName = f.name?.trim()
      if (trimmedName) {
        fieldMapByTable[f.tableId][trimmedName] = `field_${f.id}`
      }
      fieldMapByTable[f.tableId][`field_${f.id}`] = `field_${f.id}`
      fieldMapByTable[f.tableId][String(f.id)] = `field_${f.id}`
    })

    let sortFieldType: string | undefined
    if (sortField) {
      sortFieldType = fieldsMap[sortField]?.type
    }

    const result = await getMultiTableRows({
      tableIds: targetTableIds,
      cursor,
      limit,
      sortField,
      sortOrder,
      sortFieldType,
      filters,
      fieldMapByTable,
      masterViewId: masterViewId && !isNaN(masterViewId) ? masterViewId : null,
    })

    let rows: any[] = result.rows
    if (masterViewId && !isNaN(masterViewId)) {
      rows = await mergeMasterViewOverrides(masterViewId, result.rows)
    }

    const payload = {
      rows,
      nextCursor: result.nextCursor,
      fieldsMap,
      permissionInfo,
      tableCounts,
      totalRowsCount,
    }
    await setCachedMasterViewRows(cacheKey, payload, 10)

    return NextResponse.json(payload)
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
