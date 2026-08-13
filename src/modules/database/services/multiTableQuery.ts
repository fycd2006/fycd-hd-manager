import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { safeJsonParse } from '@/lib/json-utils'

export interface MultiTableQueryOptions {
  tableIds: number[]
  cursor?: string | null // Format: "timestampISO-tableId-rowId"
  limit?: number
}

export interface MultiTableParsedRow {
  id: number
  tableId: number
  data: Record<string, any>
  createdAt: Date
}

/**
 * Parses a Base64 encoded JSON cursor string into Date, tableId, and rowId.
 */
export function parseCursor(cursor: string) {
  try {
    const jsonStr = Buffer.from(cursor, 'base64').toString('utf-8')
    const data = JSON.parse(jsonStr)

    const dateObj = new Date(data.createdAt)
    const tableId = parseInt(data.tableId)
    const rowId = parseInt(data.rowId)

    if (isNaN(dateObj.getTime()) || isNaN(tableId) || isNaN(rowId)) {
      return null
    }

    return { dateObj, tableId, rowId }
  } catch (e) {
    return null
  }
}

/**
 * Generates a Base64 JSON cursor string from a row.
 */
export function generateCursor(row: { createdAt: Date, tableId: number, id: number }) {
  const data = {
    createdAt: row.createdAt.toISOString(),
    tableId: row.tableId,
    rowId: row.id
  }
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

/**
 * Phase 1: Fetch rows across multiple tables using a UNION ALL (master_union)
 * with Keyset Pagination (O(1) deep pagination).
 * Dynamic sorting is deferred to Phase 4. Currently strictly uses:
 * ORDER BY createdAt DESC, tableId DESC, id DESC
 */
export async function getMultiTableRows(options: MultiTableQueryOptions) {
  const { tableIds, cursor, limit = 50 } = options

  if (!tableIds || tableIds.length === 0) {
    return { rows: [], nextCursor: null }
  }

  // 1. Build the UNION ALL derived table
  const unionQueries = tableIds.map(tid => 
    Prisma.sql`SELECT id, tableId, data, createdAt FROM TableRow WHERE tableId = ${tid} AND deletedAt IS NULL`
  )
  const masterUnion = Prisma.join(unionQueries, ' UNION ALL ')

  // 2. Build Cursor Condition
  let cursorCondition = Prisma.sql``
  if (cursor) {
    const parsed = parseCursor(cursor)
    if (parsed) {
      cursorCondition = Prisma.sql`WHERE (createdAt, tableId, id) < (${parsed.dateObj}, ${parsed.tableId}, ${parsed.rowId})`
    }
  }

  // 3. Construct Final Query
  const finalQuery = Prisma.sql`
    SELECT * FROM (
      ${masterUnion}
    ) AS master_union
    ${cursorCondition}
    ORDER BY createdAt DESC, tableId DESC, id DESC
    LIMIT ${limit}
  `

  // 4. Execute Query
  const rawRows = await prisma.$queryRaw<Record<string, unknown>[]>(finalQuery)

  // 5. Parse Results
  const parsedRows: MultiTableParsedRow[] = rawRows.map(r => ({
    id: typeof r.id === 'bigint' ? Number(r.id) : (r.id as number),
    tableId: typeof r.tableId === 'bigint' ? Number(r.tableId) : (r.tableId as number),
    createdAt: r.createdAt as Date,
    data: safeJsonParse<Record<string, any>>(r.data, {})
  }))

  let nextCursor: string | null = null
  if (parsedRows.length === limit) {
    const lastRow = parsedRows[parsedRows.length - 1]
    nextCursor = generateCursor(lastRow)
  }

  return {
    rows: parsedRows,
    nextCursor
  }
}
