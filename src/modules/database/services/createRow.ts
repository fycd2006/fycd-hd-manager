/**
 * Shared table-row creation logic.
 *
 * Used by both the authenticated rows API (/api/tables/[tableId]/rows POST)
 * and the public form API (/api/form/[token] POST) so validation, audit
 * fields, autonumber counters and ordering stay consistent.
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { FieldRegistry } from '@/modules/database/fields/types'
import { safeJsonParse } from '@/lib/json-utils'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { evaluateFormula, extractFormulaExpression } from '@/lib/formula'

/** Field types that can never be written through a public form submission. */
export const FORM_READONLY_TYPES = [
  'link_row',
  'autonumber',
  'formula',
  'lookup',
  'rollup',
  'created_on',
  'last_modified_on',
  'created_by',
  'last_modified_by',
] as const

interface FieldShape {
  id: number
  name: string
  type: string
  options: unknown
}

export interface CreateTableRowOptions {
  tableId: number
  /** Flat map of field keys to values, e.g. { field_12: 'abc' }. */
  input: Record<string, unknown>
  /** Name recorded in created_by / last_modified_by audit fields. */
  username: string
  /**
   * Optional whitelist: only fields passing this filter are writable
   * (values for other fields are silently ignored). Audit fields are
   * always server-controlled regardless of this filter.
   */
  fieldFilter?: (field: FieldShape) => boolean
}

export type CreateTableRowResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string }

export async function createTableRow(options: CreateTableRowOptions): Promise<CreateTableRowResult> {
  const { tableId, input, username, fieldFilter } = options

  const fields = await prisma.tableField.findMany({
    where: { tableId, deletedAt: null },
    orderBy: { order: 'asc' }
  })

  const dateOpt = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' } as const
  const nowStr = new Date().toLocaleDateString('zh-TW', dateOpt)

  const rowData: Record<string, unknown> = {}
  for (const f of fields) {
    const key = `field_${f.id}`
    if (f.type === 'created_by' || f.type === 'last_modified_by') {
      rowData[key] = username
    } else if (f.type === 'created_on' || f.type === 'last_modified_on') {
      rowData[key] = nowStr
    } else if (fieldFilter && !fieldFilter(f)) {
      // Field is not writable in this context (e.g. public form): skip it
      continue
    } else if (input[key] !== undefined) {
      const fOpts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
      const fieldType = FieldRegistry.get(f.type)
      const validateRes = fieldType.validateValue(input[key], fOpts)

      if (!validateRes.valid) {
        return { ok: false, error: `欄位 [${f.name}] 驗證失敗: ${validateRes.error}` }
      }
      rowData[key] = validateRes.parsedValue
    } else {
      const fOpts = typeof f.options === 'string' ? JSON.parse(f.options) : (f.options || {})
      const fieldType = FieldRegistry.get(f.type)
      const def = fieldType.getDefaultValue(fOpts)
      if (def !== null) rowData[key] = def
    }
  }

  // Recompute formula fields if present
  const formulaFields = fields.filter(f => f.type === 'formula')
  if (formulaFields.length > 0) {
    const fieldOrder = fields.map(f => f.id)
    for (const ff of formulaFields) {
      const destKey = `field_${ff.id}`
      const expr = extractFormulaExpression(ff.options)
      if (!expr) continue
      try {
        const res = evaluateFormula(expr, rowData as Record<string, any>, fieldOrder)
        rowData[destKey] = res != null ? res : ''
      } catch {
        rowData[destKey] = '#VALUE!'
      }
    }
  }

  const row = await prisma.$transaction(async (tx) => {
    const autonumberFields = fields.filter(f => f.type === 'autonumber')
    if (autonumberFields.length > 0) {
      const dbTable = await tx.databaseTable.findUnique({ where: { id: tableId } })
      if (dbTable && dbTable.autonumberCounter === 0) {
        const existingRows = await tx.tableRow.findMany({
          where: { tableId },
          select: { data: true }
        })
        let maxVal = 0
        autonumberFields.forEach(f => {
          const key = `field_${f.id}`
          existingRows.forEach(r => {
            try {
              const parsedData: Record<string, unknown> = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : (r.data || {})
              const val = Number(parsedData[key])
              if (!isNaN(val) && val > maxVal) {
                maxVal = val
              }
            } catch { }
          })
        })
        if (maxVal > 0) {
          await tx.databaseTable.update({ where: { id: tableId }, data: { autonumberCounter: maxVal } })
        }
      }

      const updatedTable = await tx.databaseTable.update({
        where: { id: tableId },
        data: { autonumberCounter: { increment: 1 } }
      })
      const nextVal = updatedTable.autonumberCounter

      autonumberFields.forEach(f => {
        const key = `field_${f.id}`
        rowData[key] = nextVal
      })
    }

    const normalizedRowData: Record<string, unknown> = {}
    Object.entries(rowData).forEach(([k, v]) => {
      const fid = parseInt(k.replace('field_', ''))
      if (!isNaN(fid)) {
        normalizedRowData[`field_${fid}`] = v
      } else {
        normalizedRowData[k] = v
      }
    })
    const maxOrder = await tx.tableRow.aggregate({ where: { tableId }, _max: { order: true } })
    return tx.tableRow.create({
      data: {
        tableId,
        data: normalizedRowData as Prisma.InputJsonValue,
        order: (maxOrder._max.order ?? 0) + 1,
      },
    })
  }, {
    maxWait: 5000,
    timeout: 10000
  })

  // Invalidate master view cache for this table's workspace
  try {
    await invalidateMasterViewCacheForTable(tableId)
  } catch (cacheErr) {
    console.warn('[MasterViewCache Warning on createRow]:', cacheErr)
  }

  return { ok: true, row: { ...row, data: safeJsonParse(row.data, {}) } }
}
