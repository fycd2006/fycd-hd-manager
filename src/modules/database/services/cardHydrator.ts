import prisma from '@/lib/prisma'
import { safeJsonParse } from '@/lib/json-utils'
import { parseLinkRowIds } from '@/modules/database/services/linkRowSync'

export interface LinkedRowCard {
  id: number
  tableId: number
  _accessDenied?: boolean
  tableName?: string
  primaryFieldTitle?: string
  previewFields?: { id: number; name: string; type: string; value: any }[]
}

export interface HydrateCardsOptions {
  /** The rows from the source table(s) */
  rows: { id: number; tableId: number; data: Record<string, any> }[]
  /** Link row field definitions containing fieldId and options.targetTableId */
  linkRowFields: { id: number; tableId: number; options?: any }[]
  /** Set of table IDs that the current user has permission to read (canViewData) */
  authorizedTableIds: Set<number>
}

/**
 * Hydrates linked row cards for a page of rows with strict server-side authorization enforcement.
 * 
 * Security Guarantee:
 * If the user lacks read permission on a target table:
 * 1. The target table's rows and fields are NEVER queried from the database.
 * 2. The output card payload only contains `{ id, tableId, _accessDenied: true }`.
 * 3. No field titles, cell contents, or table names leak into the API response body.
 */
export async function hydrateRowCards(options: HydrateCardsOptions): Promise<Map<number, LinkedRowCard>> {
  const { rows, linkRowFields, authorizedTableIds } = options
  const cardMap = new Map<number, LinkedRowCard>()

  if (!rows || rows.length === 0 || !linkRowFields || linkRowFields.length === 0) {
    return cardMap
  }

  // 1. Group target row IDs by targetTableId
  const targetRowsByTable = new Map<number, Set<number>>()

  for (const field of linkRowFields) {
    const opts = typeof field.options === 'string' ? safeJsonParse(field.options, {}) : (field.options || {})
    const targetTableId = Number(opts.targetTableId ?? opts.link_row_table_id ?? opts.target_table_id)
    if (!targetTableId || isNaN(targetTableId)) continue

    if (!targetRowsByTable.has(targetTableId)) {
      targetRowsByTable.set(targetTableId, new Set<number>())
    }
    const idSet = targetRowsByTable.get(targetTableId)!

    const fieldKey = `field_${field.id}`
    for (const row of rows) {
      const rawVal = row.data?.[fieldKey]
      const ids = parseLinkRowIds(rawVal)
      ids.forEach(id => idSet.add(id))
    }
  }

  // 2. Separate authorized vs unauthorized target tables
  const authorizedQueryTasks: { tableId: number; rowIds: number[] }[] = []

  for (const [targetTableId, rowIdSet] of targetRowsByTable.entries()) {
    if (rowIdSet.size === 0) continue

    const rowIds = Array.from(rowIdSet)

    if (!authorizedTableIds.has(targetTableId)) {
      // 🚨 UNAUTHORIZED: Mask immediately without querying DB
      for (const rowId of rowIds) {
        cardMap.set(rowId, {
          id: rowId,
          tableId: targetTableId,
          _accessDenied: true,
        })
      }
    } else {
      // ✅ AUTHORIZED: Queue for batch hydration
      authorizedQueryTasks.push({ tableId: targetTableId, rowIds })
    }
  }

  if (authorizedQueryTasks.length === 0) {
    return cardMap
  }

  // 3. Batch query authorized target tables and fields
  const allAuthorizedTableIds = authorizedQueryTasks.map(t => t.tableId)
  const allAuthorizedRowIds = authorizedQueryTasks.flatMap(t => t.rowIds)

  const [targetTables, targetFields, targetRows] = await Promise.all([
    prisma.databaseTable.findMany({
      where: { id: { in: allAuthorizedTableIds }, deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.tableField.findMany({
      where: { tableId: { in: allAuthorizedTableIds }, deletedAt: null },
      orderBy: { order: 'asc' },
    }),
    prisma.tableRow.findMany({
      where: { id: { in: allAuthorizedRowIds }, deletedAt: null },
      select: { id: true, tableId: true, data: true },
    }),
  ])

  const tableNameMap = new Map(targetTables.map(t => [t.id, t.name]))
  const fieldsByTable = new Map<number, typeof targetFields>()
  targetFields.forEach(f => {
    const list = fieldsByTable.get(f.tableId) || []
    list.push(f)
    fieldsByTable.set(f.tableId, list)
  })

  // 4. Construct hydrated card payload for authorized rows
  for (const targetRow of targetRows) {
    const rowData = safeJsonParse<Record<string, any>>(targetRow.data, {})
    const tFields = fieldsByTable.get(targetRow.tableId) || []
    const primaryField = tFields[0]
    const primaryKey = primaryField ? `field_${primaryField.id}` : null
    
    let primaryVal = primaryKey ? rowData[primaryKey] : null
    if (primaryVal == null || primaryVal === '') {
      const firstNonEmpty = Object.values(rowData).find(v => v != null && v !== '' && typeof v !== 'object')
      primaryVal = firstNonEmpty ?? `列 ID: ${targetRow.id}`
    }

    // Include top 3 non-primary preview fields for card display
    const previewFields = tFields
      .slice(1, 4)
      .map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        value: rowData[`field_${f.id}`] ?? null,
      }))

    cardMap.set(targetRow.id, {
      id: targetRow.id,
      tableId: targetRow.tableId,
      _accessDenied: false,
      tableName: tableNameMap.get(targetRow.tableId) || '',
      primaryFieldTitle: String(primaryVal),
      previewFields,
    })
  }

  return cardMap
}
