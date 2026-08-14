/**
 * MultiTable Pure Client-Safe Utilities
 * Contains pure functions and types for multi-table queries, aggregation, and sparse mode.
 * Safe for client-side bundle (no Prisma or Node server dependencies).
 */

export interface MasterFieldInfo {
  id: number
  tableId: number
  name: string
  type: string
  options?: any
}

export interface UnifiedColumnSource {
  tableId: number
  tableName?: string
  fieldId: number
  fieldKey: string
  fieldName: string
  type: string
}

export interface UnifiedColumnInfo {
  key: string // Canonical column key (e.g. "姓名" or "field_123")
  name: string // Display name (e.g. "姓名")
  type: string // Field type (e.g. "text", "number", "single_select")
  tableFieldMap: Record<number, string> // tableId -> specific fieldKey (e.g. { 1: "field_101", 2: "field_205" })
  sampleFieldId: number
  options?: any
  sources: UnifiedColumnSource[]
  hasTypeMismatch: boolean
  mismatchedTypes: string[]
}

export interface CrossTableFilterRule {
  field: string
  operator:
    | 'contains'
    | 'not_contains'
    | 'equals'
    | 'not_equals'
    | 'higher_than'
    | 'lower_than'
    | 'is_empty'
    | 'is_not_empty'
  value?: any
}

export interface ExcludedRowInfo {
  tableId: number
  rowId: number
  value: any
}

export interface FieldSummaryData {
  count: number
  emptyCount: number
  percentFilled: number
  sum: number | null
  avg: number | null
  min: any
  max: any
  uniqueCount: number
  excludedMismatchCount: number
  excludedRows: ExcludedRowInfo[]
}

/**
 * Builds unified cross-table column metadata by grouping fields by logical name.
 * Tracks all underlying table sources, flags any field type mismatches, and supports custom alias mappings.
 */
export function buildUnifiedColumns(
  fieldsMap: Record<string, MasterFieldInfo>,
  unmergedKeys: string[] = [],
  tablesMap?: Record<number, { name: string }>,
  customAliasMap?: Record<string, string>
): UnifiedColumnInfo[] {
  const columnsByName = new Map<string, UnifiedColumnInfo>()

  for (const [key, field] of Object.entries(fieldsMap)) {
    if (!field || typeof field !== 'object') continue
    const fieldKey = key.startsWith('field_') ? key : `field_${field.id}`
    const rawColName = field.name ? field.name.trim() : fieldKey

    // Check if customAliasMap maps this field to a target column
    const aliasedColName = customAliasMap?.[fieldKey] || customAliasMap?.[rawColName] || rawColName

    const isUnmerged = unmergedKeys.includes(rawColName) || unmergedKeys.includes(fieldKey)
    const colName = isUnmerged ? `${rawColName} (表 ${field.tableId})` : aliasedColName
    const colKey = isUnmerged ? fieldKey : colName

    const srcInfo: UnifiedColumnSource = {
      tableId: field.tableId,
      tableName: tablesMap?.[field.tableId]?.name,
      fieldId: field.id,
      fieldKey,
      fieldName: field.name || fieldKey,
      type: field.type || 'text',
    }

    if (!columnsByName.has(colKey)) {
      columnsByName.set(colKey, {
        key: colKey,
        name: colName,
        type: field.type || 'text',
        tableFieldMap: { [field.tableId]: fieldKey },
        sampleFieldId: field.id,
        options: field.options,
        sources: [srcInfo],
        hasTypeMismatch: false,
        mismatchedTypes: [field.type || 'text'],
      })
    } else {
      const existing = columnsByName.get(colKey)!
      existing.tableFieldMap[field.tableId] = fieldKey
      if (!existing.options && field.options) {
        existing.options = field.options
      }
      // Check if source already tracked
      if (!existing.sources.some((s) => s.fieldId === field.id && s.tableId === field.tableId)) {
        existing.sources.push(srcInfo)
      }
      const existingTypes = new Set(existing.sources.map((s) => s.type || 'text'))
      existing.mismatchedTypes = Array.from(existingTypes)
      existing.hasTypeMismatch = existingTypes.size > 1
    }
  }

  return Array.from(columnsByName.values())
}

/**
 * Retrieves a field's value for a given row, supporting unified cross-table column alignment.
 */
export function getRowFieldValue(
  row: { tableId?: number; data?: Record<string, any> },
  columnKey: string,
  unifiedColumnsMap?: Record<string, UnifiedColumnInfo>,
  fieldsMap?: Record<string, MasterFieldInfo>
): any {
  if (!row.data || typeof row.data !== 'object') return undefined

  // 1. Direct key match (e.g. data["姓名"], data["field_101"], data["createdAt"])
  if (row.data[columnKey] !== undefined) {
    return row.data[columnKey]
  }

  const tid = row.tableId ?? 0

  // 2. Lookup via unified column mapping for this tableId
  if (unifiedColumnsMap && unifiedColumnsMap[columnKey]) {
    const tableFieldKey = unifiedColumnsMap[columnKey].tableFieldMap[tid]
    if (tableFieldKey && row.data[tableFieldKey] !== undefined) {
      return row.data[tableFieldKey]
    }
  }

  // 3. Fallback to searching fieldsMap by field.name for this row.tableId
  if (fieldsMap) {
    for (const [fKey, fInfo] of Object.entries(fieldsMap)) {
      if (fInfo.tableId === tid && (fInfo.name === columnKey || fKey === columnKey)) {
        if (row.data[fKey] !== undefined) return row.data[fKey]
      }
    }
  }

  return undefined
}

/**
 * Phase 4.3: Computes aggregation summary metrics for a specified column across rows.
 * Also calculates how many non-empty non-numeric items were excluded from numerical calculation and tracks the excluded rows.
 */
export function computeColumnSummary(
  rows: Array<{ id?: number; tableId?: number; data?: Record<string, any> }>,
  fieldKey: string,
  unifiedColumnsMap?: Record<string, UnifiedColumnInfo>,
  fieldsMap?: Record<string, MasterFieldInfo>
): FieldSummaryData {
  let count = 0
  let emptyCount = 0
  let sum: number | null = null
  let numericCount = 0
  let min: any = null
  let max: any = null
  let excludedMismatchCount = 0
  const excludedRows: ExcludedRowInfo[] = []
  const uniqueSet = new Set<string>()

  for (const r of rows) {
    const val = getRowFieldValue(r, fieldKey, unifiedColumnsMap, fieldsMap)
    if (val == null || val === '' || val === 'null') {
      emptyCount++
    } else {
      count++
      uniqueSet.add(String(val))

      const num = typeof val === 'number' ? val : (typeof val === 'string' && val.trim() !== '' ? Number(val) : NaN)
      if (!isNaN(num) && typeof val !== 'boolean') {
        sum = (sum ?? 0) + num
        numericCount++
        if (min === null || num < min) min = num
        if (max === null || num > max) max = num
      } else {
        excludedMismatchCount++
        excludedRows.push({
          tableId: r.tableId ?? 0,
          rowId: r.id ?? 0,
          value: val,
        })
        if (min === null || val < min) min = val
        if (max === null || val > max) max = val
      }
    }
  }

  const total = count + emptyCount
  const percentFilled = total > 0 ? Math.round((count / total) * 100) : 0
  const avg = numericCount > 0 && sum !== null ? Number((sum / numericCount).toFixed(2)) : null

  return {
    count,
    emptyCount,
    percentFilled,
    sum,
    avg,
    min,
    max,
    uniqueCount: uniqueSet.size,
    excludedMismatchCount,
    excludedRows,
  }
}


export interface FieldFrequencyInfo {
  key: string
  count: number
  totalRows: number
  coverageRate: number // 0 to 100
  isSparse: boolean // true if coverageRate < 30% or ranked below maxLimit
  isPinned?: boolean
}

/**
 * Analyzes field frequencies across multi-table rows to identify
 * dense common fields vs sparse columns, respecting user pinned keys.
 */
export function analyzeFieldFrequencies(
  rows: Array<{ tableId?: number; data?: Record<string, any> }>,
  maxLimit = 15,
  fieldsMap?: Record<string, MasterFieldInfo>,
  pinnedKeys: string[] = [],
  unmergedKeys: string[] = [],
  customAliasMap?: Record<string, string>
): {
  allFields: FieldFrequencyInfo[]
  defaultVisibleKeys: string[]
  sparseKeys: string[]
} {
  const totalRows = rows.length
  const fieldCounts = new Map<string, number>()
  const unifiedColumns = fieldsMap ? buildUnifiedColumns(fieldsMap, unmergedKeys, undefined, customAliasMap) : []
  const unifiedMap: Record<string, UnifiedColumnInfo> = {}
  unifiedColumns.forEach((c) => {
    unifiedMap[c.key] = c
  })


  if (unifiedColumns.length > 0) {
    // Analyze frequency using UNIFIED column definitions
    for (const col of unifiedColumns) {
      let count = 0
      for (const r of rows) {
        const val = getRowFieldValue(r, col.key, unifiedMap, fieldsMap)
        if (val != null && val !== '' && val !== 'null') {
          count++
        }
      }
      fieldCounts.set(col.key, count)
    }

    // Include any unmapped data keys
    for (const r of rows) {
      if (r.data && typeof r.data === 'object') {
        const tid = r.tableId ?? 0
        for (const [k, v] of Object.entries(r.data)) {
          if (k.startsWith('_')) continue
          const isMapped = unifiedColumns.some(
            (c) => c.key === k || c.tableFieldMap[tid] === k
          )
          if (!isMapped && !fieldCounts.has(k)) {
            if (v != null && v !== '' && v !== 'null') {
              fieldCounts.set(k, (fieldCounts.get(k) || 0) + 1)
            } else {
              fieldCounts.set(k, 0)
            }
          }
        }
      }
    }
  } else {
    // Fallback: analyze by raw keys in row.data
    for (const r of rows) {
      if (r.data && typeof r.data === 'object') {
        for (const [k, v] of Object.entries(r.data)) {
          if (!k.startsWith('_') && v != null && v !== '' && v !== 'null') {
            fieldCounts.set(k, (fieldCounts.get(k) || 0) + 1)
          } else if (!k.startsWith('_') && !fieldCounts.has(k)) {
            fieldCounts.set(k, 0)
          }
        }
      }
    }
  }

  const pinnedSet = new Set(pinnedKeys)

  const allFields: FieldFrequencyInfo[] = Array.from(fieldCounts.entries())
    .map(([key, count]) => {
      const coverageRate = totalRows > 0 ? Math.round((count / totalRows) * 100) : 0
      return {
        key,
        count,
        totalRows,
        coverageRate,
        isSparse: false,
        isPinned: pinnedSet.has(key),
      }
    })
    .sort((a, b) => {
      // Pinned fields first, then by frequency count
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return b.count - a.count || a.key.localeCompare(b.key)
    })

  allFields.forEach((f, idx) => {
    if (f.isPinned) {
      f.isSparse = false
    } else {
      f.isSparse = idx >= maxLimit || f.coverageRate < 30
    }
  })

  // Visible keys: all pinned keys + non-sparse keys up to maxLimit
  const defaultVisibleKeys = allFields
    .filter((f, idx) => f.isPinned || idx < maxLimit)
    .map((f) => f.key)

  const sparseKeys = allFields
    .filter((f) => !defaultVisibleKeys.includes(f.key))
    .map((f) => f.key)

  return {
    allFields,
    defaultVisibleKeys,
    sparseKeys,
  }
}

