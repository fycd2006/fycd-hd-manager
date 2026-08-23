import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { evaluateFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'

export interface QueryOptions {
  rowId?: number | string | null
  sortField?: string | null
  sortOrder?: string | null
  filterParam?: string | null
  searchQuery?: string | null
  pageParam?: string | null
  pageSizeParam?: string | null
}

export interface ParsedRow {
  id: number
  tableId: number
  data: Record<string, any>
  order: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

// Field types whose displayed value is computed/populated after fetching.
// Filtering/sorting on these must stay in memory (slow path) because the
// legacy semantics operate on the populated value, not the stored one.
const POPULATED_TYPES = new Set([
  'link_row', 'lookup', 'rollup', 'formula', 'collaborator',
  'created_on', 'last_modified_on', 'created_by', 'last_modified_by',
])

const NUMERIC_TYPES = new Set(['number', 'rating', 'percent', 'currency', 'autonumber'])

// Date operators rely on JS Date parsing of arbitrary stored formats and
// cannot be expressed reliably in SQL — they always take the slow path.
const DATE_OPERATORS = new Set(['date_equal', 'date_before', 'date_after'])

interface FieldMeta {
  id: number
  type: string
  options: unknown
}

const FIELD_KEY_RE = /^field_\d+$/

/** Escape LIKE wildcards in user input (used with ESCAPE '\\'). */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * JSON text extraction for a validated field key (field_\d+ only, injection-safe).
 * Handles BOTH storage shapes present in production data:
 *  - proper JSON objects (written via raw SQL batch updates)
 *  - legacy double-encoded rows where `data` is a JSON string containing JSON
 *    (written via Prisma Json field with a pre-stringified value)
 * JSON_UNQUOTE(data) unwraps the outer string in the legacy case and is a
 * no-op for proper objects, so JSON_EXTRACT works uniformly afterwards.
 */
function jsonExtractSql(fieldKey: string): string {
  return `JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(data), '$."${fieldKey}"'))`
}

/**
 * Normalized cell text matching legacy `String(row.data[key] ?? '')` semantics:
 * missing keys and JSON null both become ''.
 */
function jsonCellTextSql(fieldKey: string): string {
  return `COALESCE(NULLIF(${jsonExtractSql(fieldKey)}, 'null'), '')`
}

/**
 * Numeric cell value matching legacy `Number(cellValue)` semantics:
 * missing/null/empty become 0; non-numeric strings stay as-is (excluded by
 * the REGEXP guard in numeric filters).
 */
function jsonCellNumSql(fieldKey: string): string {
  return `COALESCE(NULLIF(${jsonCellTextSql(fieldKey)}, ''), '0')`
}

/**
 * Builds a SQL fragment for a single filter rule on a stored (non-computed)
 * field. Returns null when the operator cannot be pushed down.
 */
function buildFilterSql(fieldKey: string, operator: string, value: string): Prisma.Sql | null {
  const x = Prisma.raw(jsonCellTextSql(fieldKey))
  const nx = Prisma.raw(jsonCellNumSql(fieldKey))
  switch (operator) {
    case 'contains':
      return Prisma.sql`LOWER(${x}) LIKE CONCAT('%', ${escapeLike(value.toLowerCase())}, '%') ESCAPE '\\\\'`
    case 'not_contains':
      return Prisma.sql`NOT (LOWER(${x}) LIKE CONCAT('%', ${escapeLike(value.toLowerCase())}, '%') ESCAPE '\\\\')`
    case 'equals':
      return Prisma.sql`${x} = ${value}`
    case 'not_equals':
      return Prisma.sql`${x} <> ${value}`
    case 'higher_than':
      return Prisma.sql`(${nx} REGEXP '^-?[0-9]+(\\.[0-9]+)?$' AND CAST(${nx} AS DECIMAL(30,10)) > ${Number(value)})`
    case 'higher_than_or_equal':
      return Prisma.sql`(${nx} REGEXP '^-?[0-9]+(\\.[0-9]+)?$' AND CAST(${nx} AS DECIMAL(30,10)) >= ${Number(value)})`
    case 'lower_than':
      return Prisma.sql`(${nx} REGEXP '^-?[0-9]+(\\.[0-9]+)?$' AND CAST(${nx} AS DECIMAL(30,10)) < ${Number(value)})`
    case 'lower_than_or_equal':
      return Prisma.sql`(${nx} REGEXP '^-?[0-9]+(\\.[0-9]+)?$' AND CAST(${nx} AS DECIMAL(30,10)) <= ${Number(value)})`
    case 'not_empty':
      return Prisma.sql`(${x} NOT IN ('', 'null', 'undefined'))`
    case 'empty':
      return Prisma.sql`(${x} IN ('', 'null', 'undefined'))`
    default:
      // Unknown operators are a no-op in the legacy in-memory implementation
      return Prisma.sql`1 = 1`
  }
}

/** Builds the ORDER BY fragment for a stored field. */
function buildOrderSql(fieldKey: string, fieldType: string, sortOrder: string): Prisma.Sql {
  const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'
  if (NUMERIC_TYPES.has(fieldType)) {
    // Legacy semantics treat missing values as Number('') === 0
    return Prisma.raw(`CAST(${jsonCellNumSql(fieldKey)} AS DECIMAL(30,10)) ${dir}`)
  }
  return Prisma.raw(`${jsonCellTextSql(fieldKey)} ${dir}`)
}

/** Normalizes a raw $queryRaw row (BigInt safety, JSON parsing). */
function sanitizeRawRow(r: Record<string, unknown>): ParsedRow {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(r)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v
  }
  return { ...out, data: safeJsonParse<Record<string, any>>(out.data, {}) } as unknown as ParsedRow
}

function parseLinkRowIds(val: any): number[] {
  if (val === null || val === undefined) return []
  let list: any[] = []
  if (Array.isArray(val)) {
    list = val
  } else if (typeof val === 'string' && val.trim()) {
    try {
      const parsedJson = JSON.parse(val)
      if (Array.isArray(parsedJson)) list = parsedJson
      else list = [parsedJson]
    } catch {
      list = val.split(',').map(s => s.trim()).filter(Boolean)
    }
  } else {
    list = [val]
  }
  return list.map(item => {
    if (typeof item === 'object' && item !== null) {
      return Number(item.id)
    }
    return Number(item)
  }).filter(n => !isNaN(n) && n > 0)
}


/**
 * Populates display values (link_row labels, collaborators, lookup, rollup,
 * formula, audit fields) for the given rows. Shared by both query paths.
 */
async function populateRows(rows: ParsedRow[], fields: FieldMeta[]): Promise<ParsedRow[]> {
  if (rows.length === 0) return rows

  const linkRowFields = fields.filter(f => f.type === 'link_row')
  const lookupFields = fields.filter(f => f.type === 'lookup')
  const rollupFields = fields.filter(f => f.type === 'rollup')
  const formulaFields = fields.filter(f => f.type === 'formula')
  const collaboratorFields = fields.filter(f => f.type === 'collaborator')
  const auditFields = fields.filter(f => ['created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

  // Query system users for collaborator name mapping if needed
  const userMap = new Map<number, string>()
  if (collaboratorFields.length > 0) {
    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true }
    })
    allUsers.forEach(u => userMap.set(u.id, u.username))
  }

  // Collect all target row IDs from link_row fields
  const targetRowIds = new Set<number>()
  rows.forEach(row => {
    linkRowFields.forEach(f => {
      const key = `field_${f.id}`
      const ids = parseLinkRowIds(row.data[key])
      ids.forEach(id => targetRowIds.add(id))
    })
  })

  const activeRelationFields: Record<number, { relationFieldId: number; targetFieldId: number; type: string; rollupFunction?: string }> = {}

  lookupFields.forEach(lf => {
    const opts = safeJsonParse(lf.options, {} as any)
    if (opts.relationFieldId && opts.targetFieldId) {
      activeRelationFields[lf.id] = {
        relationFieldId: opts.relationFieldId,
        targetFieldId: opts.targetFieldId,
        type: 'lookup'
      }
    }
  })

  rollupFields.forEach(rf => {
    const opts = safeJsonParse(rf.options, {} as any)
    if (opts.relationFieldId && opts.targetFieldId) {
      activeRelationFields[rf.id] = {
        relationFieldId: opts.relationFieldId,
        targetFieldId: opts.targetFieldId,
        type: 'rollup',
        rollupFunction: opts.rollupFunction || 'sum'
      }
    }
  })

  rows.forEach(row => {
    Object.values(activeRelationFields).forEach(ref => {
      const key = `field_${ref.relationFieldId}`
      const ids = parseLinkRowIds(row.data[key])
      ids.forEach(id => targetRowIds.add(id))
    })
  })

  // Query target rows in bulk
  const targetRowsMap = new Map<number, Record<string, any>>()
  const targetDisplayMap = new Map<number, string>()

  if (targetRowIds.size > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: Array.from(targetRowIds) }, deletedAt: null },
    })

    const targetTableIds = Array.from(new Set(targetRows.map(tr => tr.tableId)))
    const targetFields = await prisma.tableField.findMany({
      where: { tableId: { in: targetTableIds }, deletedAt: null },
      orderBy: { order: 'asc' }
    })

    const targetPrimaryFieldMap = new Map<number, string>()
    targetTableIds.forEach(tid => {
      const tfList = targetFields.filter(f => f.tableId === tid)
      if (tfList.length > 0) {
        targetPrimaryFieldMap.set(tid, `field_${tfList[0].id}`)
      }
    })

    targetRows.forEach(tr => {
      const trData = safeJsonParse<Record<string, any>>(tr.data, {})
      targetRowsMap.set(tr.id, trData)

      const primaryKey = targetPrimaryFieldMap.get(tr.tableId)
      let primaryVal = primaryKey ? trData[primaryKey] : null

      if (primaryVal == null || primaryVal === '') {
        const firstNonEmpty = Object.values(trData).find(v => v != null && v !== '' && typeof v !== 'object')
        primaryVal = firstNonEmpty ?? `列 ID: ${tr.id}`
      }

      targetDisplayMap.set(tr.id, String(primaryVal))
    })
  }

  // Populate values
  return rows.map(row => {
    const newData = { ...row.data }

    linkRowFields.forEach(f => {
      const key = `field_${f.id}`
      const val = newData[key]
      const ids = parseLinkRowIds(val)
      newData[key] = ids
        .filter(id => targetDisplayMap.has(id))
        .map(id => {
          const displayLabel = targetDisplayMap.get(id)
          return {
            id,
            value: displayLabel || `列 ID: ${id}`
          }
        })
    })

    collaboratorFields.forEach(f => {
      const key = `field_${f.id}`
      const val = newData[key]
      let list: number[] = []
      if (Array.isArray(val)) {
        list = val.map(item => {
          if (typeof item === 'object' && item !== null && 'id' in item) {
            return Number(item.id)
          }
          return Number(item)
        }).filter(n => !isNaN(n))
      } else if (typeof val === 'string' && val.trim()) {
        try {
          const parsedList = JSON.parse(val)
          if (Array.isArray(parsedList)) {
            list = parsedList.map((item: any) => {
              if (typeof item === 'object' && item !== null && 'id' in item) {
                return Number(item.id)
              }
              return Number(item)
            }).filter(n => !isNaN(n))
          } else {
            list = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
          }
        } catch {
          list = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        }
      } else if (typeof val === 'number') {
        list = [val]
      }

      newData[key] = list.map(uid => ({
        id: uid,
        username: userMap.get(uid) || `用戶 ID: ${uid}`
      }))
    })

    Object.entries(activeRelationFields).forEach(([fieldIdStr, ref]) => {
      const destKey = `field_${fieldIdStr}`
      const relationKey = `field_${ref.relationFieldId}`
      const relationIds = parseLinkRowIds(row.data[relationKey])

      const values: any[] = []
      relationIds.forEach(id => {
        const trData = targetRowsMap.get(Number(id))
        if (trData) {
          const targetVal = trData[`field_${ref.targetFieldId}`]
          if (targetVal != null && targetVal !== '') {
            if (Array.isArray(targetVal)) {
              const formatted = targetVal.map(item =>
                typeof item === 'object' && item !== null ? (item.value || item.name || item.username || JSON.stringify(item)) : String(item)
              ).filter(Boolean).join(', ')
              if (formatted) values.push(formatted)
            } else if (typeof targetVal === 'object' && targetVal !== null) {
              values.push(targetVal.value || targetVal.name || targetVal.username || JSON.stringify(targetVal))
            } else {
              values.push(String(targetVal))
            }
          }
        }
      })

      if (ref.type === 'lookup') {
        newData[destKey] = values.join(', ')
      } else if (ref.type === 'rollup') {
        const numValues = values.map(Number).filter(n => !isNaN(n))
        if (numValues.length === 0) {
          newData[destKey] = 0
          return
        }

        if (ref.rollupFunction === 'sum') {
          newData[destKey] = numValues.reduce((a, b) => a + b, 0)
        } else if (ref.rollupFunction === 'count') {
          newData[destKey] = numValues.length
        } else if (ref.rollupFunction === 'average') {
          newData[destKey] = numValues.reduce((a, b) => a + b, 0) / numValues.length
        } else {
          newData[destKey] = 0
        }
      }
    })

    formulaFields.forEach(ff => {
      const destKey = `field_${ff.id}`
      let expr = ff.options
      if (!expr) {
        newData[destKey] = ''
        return
      }

      if (typeof expr === 'string' && (expr.startsWith('{') || expr.startsWith('"'))) {
        try {
          let parsedOpts = JSON.parse(expr)
          if (typeof parsedOpts === 'string') {
            try { parsedOpts = JSON.parse(parsedOpts) } catch {}
          }
          if (parsedOpts && typeof parsedOpts === 'object' && parsedOpts.formula) {
            expr = parsedOpts.formula
          }
        } catch {}
      }

      try {
        const fieldOrder = fields.map(f => f.id)
        const result = evaluateFormula(expr, newData, fieldOrder)
        newData[destKey] = result != null ? String(result) : ''
      } catch {
        newData[destKey] = '#VALUE!'
      }
    })

    auditFields.forEach(af => {
      const destKey = `field_${af.id}`
      const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const

      switch (af.type) {
        case 'created_on':
          newData[destKey] = new Date(row.createdAt).toLocaleDateString('zh-TW', dateOpt)
          break
        case 'last_modified_on':
          newData[destKey] = new Date(row.updatedAt).toLocaleDateString('zh-TW', dateOpt)
          break
        case 'created_by':
        case 'last_modified_by': {
          const val = row.data[destKey]
          if (val && typeof val === 'object') {
            newData[destKey] = val.username || val.name || val.label || JSON.stringify(val)
          } else {
            newData[destKey] = val || '系統管理員'
          }
          break
        }
      }
    })

    return { ...row, data: newData }
  })
}

export async function getPopulatedTableRows(tableId: number, options: QueryOptions) {
  const { rowId, sortField, sortOrder = 'asc', filterParam, searchQuery, pageParam, pageSizeParam } = options

  // 1. Fetch fields to identify special field types
  const fields = await prisma.tableField.findMany({
    where: { tableId, deletedAt: null },
    orderBy: { order: 'asc' }
  })

  const fieldByKey = new Map(fields.map(f => [`field_${f.id}`, f]))

  // 2. Decide whether filter/sort can be pushed down to the database
  let parsedFilter: { fieldKey: string; operator: string; value: string } | null = null
  if (filterParam) {
    const parts = filterParam.split(':')
    if (parts.length >= 3) {
      const [fieldKey, operator, ...rest] = parts
      parsedFilter = { fieldKey, operator, value: rest.join(':') }
    }
  }

  const filterFieldMeta = parsedFilter && FIELD_KEY_RE.test(parsedFilter.fieldKey)
    ? fieldByKey.get(parsedFilter.fieldKey)
    : undefined
  const filterPushable = !parsedFilter || (
    filterFieldMeta !== undefined &&
    !POPULATED_TYPES.has(filterFieldMeta.type) &&
    !DATE_OPERATORS.has(parsedFilter.operator)
  )

  const sortFieldMeta = sortField && FIELD_KEY_RE.test(sortField)
    ? fieldByKey.get(sortField)
    : undefined
  const sortPushable = !sortField || (sortFieldMeta !== undefined && !POPULATED_TYPES.has(sortFieldMeta.type))

  const wantPagination = pageSizeParam !== 'all' && Boolean(pageParam || pageSizeParam) && !rowId
  const page = Math.max(1, parseInt(pageParam || '1') || 1)
  const pageSize = Math.max(1, parseInt(pageSizeParam || '50') || 50)

  // ===================== FAST PATH =====================
  // Filter + sort + search + pagination all executed in the database.
  // Display-value population runs only for the rows actually returned.
  if (sortPushable && filterPushable) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`tableId = ${tableId}`,
      Prisma.sql`deletedAt IS NULL`,
    ]

    if (rowId) {
      const parsedRowId = typeof rowId === 'number' ? rowId : parseInt(String(rowId), 10)
      if (!isNaN(parsedRowId)) {
        conditions.push(Prisma.sql`id = ${parsedRowId}`)
      }
    }

    const sanitized = (searchQuery || '').slice(0, 100).trim()
    if (sanitized) {
      // NOTE: LIKE on the raw JSON document — may also match field keys.
      // Same semantics as the legacy Prisma `contains` implementation.
      conditions.push(Prisma.sql`data LIKE CONCAT('%', ${escapeLike(sanitized)}, '%') ESCAPE '\\\\'`)
    }

    if (parsedFilter && filterFieldMeta) {
      const fragment = buildFilterSql(parsedFilter.fieldKey, parsedFilter.operator, parsedFilter.value)
      if (fragment) conditions.push(fragment)
    }

    const whereSql = Prisma.join(conditions, ' AND ')
    const orderSql = sortFieldMeta
      ? buildOrderSql(sortField as string, sortFieldMeta.type, sortOrder || 'asc')
      : Prisma.sql`` // fall through to default ordering below
    const defaultOrder = Prisma.sql`\`order\` ASC, id ASC`
    const effectiveOrder = sortFieldMeta ? orderSql : defaultOrder

    const offset = (page - 1) * pageSize

    const countResult = wantPagination
      ? await prisma.$queryRaw<{ total: bigint | number }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM TableRow WHERE ${whereSql}`
        )
      : null
    const totalRows = countResult ? Number(countResult[0]?.total ?? 0) : 0

    const rawRows = await prisma.$queryRaw<Record<string, unknown>[]>(
      wantPagination
        ? Prisma.sql`SELECT id, clientId, tableId, data, \`order\`, createdAt, updatedAt, deletedAt FROM TableRow WHERE ${whereSql} ORDER BY ${effectiveOrder} LIMIT ${pageSize} OFFSET ${offset}`
        : Prisma.sql`SELECT id, clientId, tableId, data, \`order\`, createdAt, updatedAt, deletedAt FROM TableRow WHERE ${whereSql} ORDER BY ${effectiveOrder}`
    )

    let rawParsed = rawRows.map(sanitizeRawRow)
    const populated = await populateRows(rawParsed, fields)

    if (wantPagination) {
      return {
        isPaginated: true,
        data: {
          rows: populated,
          pagination: {
            page,
            pageSize,
            totalRows,
            totalPages: Math.ceil(totalRows / pageSize)
          }
        }
      }
    }

    return { rows: populated, isPaginated: false }
  }

  // ===================== SLOW PATH (legacy semantics) =====================
  // Used when filtering/sorting on computed fields (formula, lookup, rollup,
  // link_row labels, collaborators, audit) or date operators: the legacy
  // behavior operates on populated values, so rows must be enriched first.
  let whereCondition: any = { tableId, deletedAt: null }
  if (rowId) {
    const parsedRowId = typeof rowId === 'number' ? rowId : parseInt(String(rowId), 10)
    if (!isNaN(parsedRowId)) {
      whereCondition.id = parsedRowId
    }
  }
  if (searchQuery) {
    const sanitized = searchQuery.slice(0, 100).trim()
    if (sanitized) {
      whereCondition = {
        tableId,
        deletedAt: null,
        data: {
          contains: sanitized
        }
      }
    }
  }

  const rows = await prisma.tableRow.findMany({
    where: whereCondition,
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  })

  let parsed: ParsedRow[] = rows.map(r => ({ ...r, data: safeJsonParse<Record<string, any>>(r.data, {}) }))
  parsed = await populateRows(parsed, fields)

  // Apply filters (operates on populated values)
  if (parsedFilter) {
    const { fieldKey, operator, value: filterValue } = parsedFilter
    parsed = parsed.filter(row => {
      const cellValue = String(row.data[fieldKey] ?? '')
      switch (operator) {
        case 'contains': return cellValue.toLowerCase().includes(filterValue.toLowerCase())
        case 'not_contains': return !cellValue.toLowerCase().includes(filterValue.toLowerCase())
        case 'equals': return cellValue === filterValue
        case 'not_equals': return cellValue !== filterValue
        case 'higher_than': return !isNaN(Number(cellValue)) && Number(cellValue) > Number(filterValue)
        case 'higher_than_or_equal': return !isNaN(Number(cellValue)) && Number(cellValue) >= Number(filterValue)
        case 'lower_than': return !isNaN(Number(cellValue)) && Number(cellValue) < Number(filterValue)
        case 'lower_than_or_equal': return !isNaN(Number(cellValue)) && Number(cellValue) <= Number(filterValue)
        case 'date_equal': {
          const d1 = new Date(cellValue).getTime()
          const d2 = new Date(filterValue).getTime()
          return !isNaN(d1) && !isNaN(d2) && new Date(d1).toDateString() === new Date(d2).toDateString()
        }
        case 'date_before': {
          const d1 = new Date(cellValue).getTime()
          const d2 = new Date(filterValue).getTime()
          return !isNaN(d1) && !isNaN(d2) && d1 < d2
        }
        case 'date_after': {
          const d1 = new Date(cellValue).getTime()
          const d2 = new Date(filterValue).getTime()
          return !isNaN(d1) && !isNaN(d2) && d1 > d2
        }
        case 'not_empty': return cellValue !== '' && cellValue !== 'null' && cellValue !== 'undefined'
        case 'empty': return cellValue === '' || cellValue === 'null' || cellValue === 'undefined'
        default: return true
      }
    })
  }

  // Apply sort (operates on populated values)
  if (sortField) {
    parsed.sort((a, b) => {
      const va = a.data[sortField] ?? ''
      const vb = b.data[sortField] ?? ''
      const numA = Number(va)
      const numB = Number(vb)
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }
      return sortOrder === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
  }

  const totalRows = parsed.length

  if (pageSizeParam === 'all') {
    return { rows: parsed, isPaginated: false }
  }

  if (pageParam || pageSizeParam) {
    const startIndex = (page - 1) * pageSize
    const paginatedRows = parsed.slice(startIndex, startIndex + pageSize)

    return {
      isPaginated: true,
      data: {
        rows: paginatedRows,
        pagination: {
          page,
          pageSize,
          totalRows,
          totalPages: Math.ceil(totalRows / pageSize)
        }
      }
    }
  }

  return { rows: parsed, isPaginated: false }
}
