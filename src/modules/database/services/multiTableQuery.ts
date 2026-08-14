import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { safeJsonParse } from '@/lib/json-utils'

export * from './multiTableUtils'
import type { CrossTableFilterRule } from './multiTableUtils'

export interface MultiTableQueryOptions {
  tableIds: number[]
  cursor?: string | null // base64url-encoded JSON
  limit?: number
  sortField?: string | null
  sortOrder?: 'asc' | 'desc'
  filters?: CrossTableFilterRule[]
  fieldMapByTable?: Record<number, Record<string, string>> // tableId -> { fieldName: "field_123" }
}

export interface MultiTableParsedRow {
  id: number
  tableId: number
  data: Record<string, any>
  createdAt: Date
  updatedAt?: Date
}


export interface ParsedCursor {
  sortField: string
  sortOrder: 'asc' | 'desc'
  sortValue: any
  tableId: number
  rowId: number
}

/**
 * Validates and normalizes sort field keys to prevent SQL injection.
 * Only allows alphanumeric characters, underscores, hyphens, and Unicode chars.
 */
export function sanitizeSortField(field: string | null | undefined): string {
  if (!field || typeof field !== 'string') return 'createdAt'
  const trimmed = field.trim()
  if (trimmed === 'createdAt' || trimmed === 'id' || trimmed === 'tableId') {
    return trimmed
  }
  // Strip control chars and quote delimiters
  const sanitized = trimmed.replace(/["'`;\\]/g, '')
  return sanitized || 'createdAt'
}

/**
 * Batch-fetches all authorized table IDs within a workspace in a single query.
 */
export async function getAuthorizedTableIds(workspaceId: number): Promise<number[]> {
  const tables = await prisma.databaseTable.findMany({
    where: {
      deletedAt: null,
      database: { workspaceId },
    },
    select: { id: true },
  })
  return tables.map((t) => t.id)
}

/**
 * Builds an injection-safe Prisma SQL condition for a single cross-table filter rule.
 */
export function buildCrossTableFilterSql(
  rule: CrossTableFilterRule,
  tableId?: number,
  fieldMapByTable?: Record<number, Record<string, string>>
): Prisma.Sql | null {
  if (!rule || !rule.field || !rule.operator) return null

  let field = sanitizeSortField(rule.field)
  if (tableId && fieldMapByTable?.[tableId]?.[field]) {
    field = fieldMapByTable[tableId][field]
  }

  const op = rule.operator
  const rawVal = rule.value != null ? String(rule.value) : ''

  const isCreatedAt = field === 'createdAt'
  const isId = field === 'id'

  let targetSql: Prisma.Sql
  if (isCreatedAt) {
    targetSql = Prisma.sql`createdAt`
  } else if (isId) {
    targetSql = Prisma.sql`id`
  } else {
    const jsonPath = `$."${field.replace(/"/g, '\\"')}"`
    targetSql = Prisma.sql`COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(data), ${jsonPath})), '')`
  }



  switch (op) {
    case 'contains':
      return Prisma.sql`LOWER(${targetSql}) LIKE ${'%' + rawVal.toLowerCase() + '%'}`
    case 'not_contains':
      return Prisma.sql`NOT (LOWER(${targetSql}) LIKE ${'%' + rawVal.toLowerCase() + '%'})`
    case 'equals':
      return Prisma.sql`${targetSql} = ${rawVal}`
    case 'not_equals':
      return Prisma.sql`${targetSql} <> ${rawVal}`
    case 'higher_than': {
      const num = Number(rawVal)
      if (isNaN(num)) return null
      return Prisma.sql`CAST(${targetSql} AS DECIMAL(30,10)) > ${num}`
    }
    case 'lower_than': {
      const num = Number(rawVal)
      if (isNaN(num)) return null
      return Prisma.sql`CAST(${targetSql} AS DECIMAL(30,10)) < ${num}`
    }
    case 'is_empty':
      return Prisma.sql`(${targetSql} IS NULL OR ${targetSql} = '' OR ${targetSql} = 'null')`
    case 'is_not_empty':
      return Prisma.sql`(${targetSql} IS NOT NULL AND ${targetSql} <> '' AND ${targetSql} <> 'null')`
    default:
      return null
  }
}

/**
 * Parses a base64url-encoded JSON cursor string into dynamic sort parameters and row coordinates.
 * Backward-compatible with legacy {createdAt, tableId, rowId} cursors.
 */
export function parseCursor(cursor: string): ParsedCursor | null {
  try {
    const jsonStr = Buffer.from(cursor, 'base64url').toString('utf-8')
    const data = JSON.parse(jsonStr)

    // Legacy format support { createdAt, tableId, rowId }
    if (data && data.createdAt && typeof data.tableId === 'number' && typeof data.rowId === 'number') {
      return {
        sortField: 'createdAt',
        sortOrder: 'desc',
        sortValue: typeof data.createdAt === 'string' ? new Date(data.createdAt) : data.createdAt,
        tableId: data.tableId,
        rowId: data.rowId,
      }
    }

    if (
      data &&
      typeof data.sortField === 'string' &&
      (data.sortOrder === 'asc' || data.sortOrder === 'desc') &&
      typeof data.tableId === 'number' &&
      typeof data.rowId === 'number'
    ) {
      let sortValue = data.sortValue
      if (data.sortField === 'createdAt' && typeof sortValue === 'string') {
        sortValue = new Date(sortValue)
      }
      return {
        sortField: sanitizeSortField(data.sortField),
        sortOrder: data.sortOrder,
        sortValue,
        tableId: data.tableId,
        rowId: data.rowId,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Generates an opaque base64url Keyset Cursor.
 */
export function generateCursor(
  lastRow: MultiTableParsedRow,
  sortField: string = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): string {
  let sortValue: any = null
  if (sortField === 'createdAt') {
    sortValue = lastRow.createdAt instanceof Date ? lastRow.createdAt.toISOString() : String(lastRow.createdAt)
  } else if (sortField === 'id') {
    sortValue = lastRow.id
  } else {
    const rawVal = lastRow.data?.[sortField]
    sortValue = rawVal != null ? String(rawVal) : ''
  }

  const payload: ParsedCursor = {
    sortField,
    sortOrder,
    sortValue,
    tableId: lastRow.tableId,
    rowId: lastRow.id,
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

/**
 * Phase 4.1 & 4.2: Fetch rows across multiple tables using UNION ALL
 * with Dynamic Column Sorting, Dynamic Filtering, and Keyset Pagination (O(1) deep pagination).
 */
export async function getMultiTableRows(options: MultiTableQueryOptions) {
  const {
    tableIds,
    cursor,
    limit = 50,
    sortField: rawSortField,
    sortOrder: rawSortOrder,
    filters = [],
    fieldMapByTable,
  } = options

  if (!tableIds || tableIds.length === 0) {
    return { rows: [], nextCursor: null }
  }

  const sortField = sanitizeSortField(rawSortField)
  const sortOrder: 'asc' | 'desc' = rawSortOrder === 'asc' ? 'asc' : 'desc'
  const isAsc = sortOrder === 'asc'
  const isCreatedAt = sortField === 'createdAt'
  const isId = sortField === 'id'

  // 1. Build UNION ALL derived query
  const unionQueries: Prisma.Sql[] = tableIds.map((tid) => {
    // Determine the actual column key in this table for sorting
    let actualSortField = sortField
    if (fieldMapByTable?.[tid]?.[sortField]) {
      actualSortField = fieldMapByTable[tid][sortField]
    }

    // Build filter SQL pushdown specifically for this table
    const tableFilterSqls = filters
      .map((f) => buildCrossTableFilterSql(f, tid, fieldMapByTable))
      .filter((s): s is Prisma.Sql => s !== null)

    const tableFilterClause =
      tableFilterSqls.length > 0
        ? Prisma.sql`AND (${Prisma.join(tableFilterSqls, ' AND ')})`
        : Prisma.sql``

    if (isCreatedAt || isId) {
      return Prisma.sql`SELECT id, tableId, data, createdAt, updatedAt FROM TableRow WHERE tableId = ${tid} AND deletedAt IS NULL ${tableFilterClause}`
    } else {
      const jsonPath = `$."${actualSortField.replace(/"/g, '\\"')}"`
      return Prisma.sql`SELECT id, tableId, data, createdAt, updatedAt, COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(data), ${jsonPath})), '') AS sort_val FROM TableRow WHERE tableId = ${tid} AND deletedAt IS NULL ${tableFilterClause}`
    }
  })

  const masterUnion = Prisma.join(unionQueries, ' UNION ALL ')

  // 2. Build Keyset Cursor Condition
  let cursorCondition = Prisma.sql``
  if (cursor) {
    const parsed = parseCursor(cursor)
    if (parsed) {
      if (isCreatedAt) {
        const dateVal = parsed.sortValue instanceof Date ? parsed.sortValue : new Date(parsed.sortValue)
        cursorCondition = isAsc
          ? Prisma.sql`WHERE (createdAt, tableId, id) > (${dateVal}, ${parsed.tableId}, ${parsed.rowId})`
          : Prisma.sql`WHERE (createdAt, tableId, id) < (${dateVal}, ${parsed.tableId}, ${parsed.rowId})`
      } else if (isId) {
        cursorCondition = isAsc
          ? Prisma.sql`WHERE (id, tableId) > (${parsed.rowId}, ${parsed.tableId})`
          : Prisma.sql`WHERE (id, tableId) < (${parsed.rowId}, ${parsed.tableId})`
      } else {
        const strVal = String(parsed.sortValue ?? '')
        cursorCondition = isAsc
          ? Prisma.sql`WHERE (sort_val, tableId, id) > (${strVal}, ${parsed.tableId}, ${parsed.rowId})`
          : Prisma.sql`WHERE (sort_val, tableId, id) < (${strVal}, ${parsed.tableId}, ${parsed.rowId})`
      }
    }
  }

  // 3. Construct Order By Clause
  let orderByClause: Prisma.Sql
  if (isCreatedAt) {
    orderByClause = isAsc
      ? Prisma.sql`ORDER BY createdAt ASC, tableId ASC, id ASC`
      : Prisma.sql`ORDER BY createdAt DESC, tableId DESC, id DESC`
  } else if (isId) {
    orderByClause = isAsc
      ? Prisma.sql`ORDER BY id ASC, tableId ASC`
      : Prisma.sql`ORDER BY id DESC, tableId DESC`
  } else {
    orderByClause = isAsc
      ? Prisma.sql`ORDER BY sort_val ASC, tableId ASC, id ASC`
      : Prisma.sql`ORDER BY sort_val DESC, tableId DESC, id DESC`
  }

  // 4. Construct Final Query
  const finalQuery = Prisma.sql`
    SELECT * FROM (
      ${masterUnion}
    ) AS master_union
    ${cursorCondition}
    ${orderByClause}
    LIMIT ${limit}
  `

  // 5. Execute Query
  const rawRows = await prisma.$queryRaw<Record<string, unknown>[]>(finalQuery)

  // 6. Parse Results
  const parsedRows: MultiTableParsedRow[] = rawRows.map((r) => ({
    id: typeof r.id === 'bigint' ? Number(r.id) : (r.id as number),
    tableId: typeof r.tableId === 'bigint' ? Number(r.tableId) : (r.tableId as number),
    createdAt: r.createdAt ? new Date(r.createdAt as any) : new Date(),
    updatedAt: r.updatedAt ? new Date(r.updatedAt as any) : undefined,
    data: safeJsonParse<Record<string, any>>(r.data, {}),
  }))


  let nextCursor: string | null = null
  if (parsedRows.length === limit) {
    const lastRow = parsedRows[parsedRows.length - 1]
    nextCursor = generateCursor(lastRow, sortField, sortOrder)
  }

  return {
    rows: parsedRows,
    nextCursor,
  }
}
