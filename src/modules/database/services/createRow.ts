/**
 * Shared table-row creation logic.
 *
 * Used by both the authenticated rows API (/api/tables/[tableId]/rows POST)
 * and the public form API (/api/form/[token] POST) so validation, audit
 * fields, autonumber counters and ordering stay consistent.
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { READ_ONLY_FIELD_TYPES } from '@/modules/database/fields/types/ReadOnlyFieldTypes'
import { safeJsonParse } from '@/lib/json-utils'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { evaluateFormula, extractFormulaExpression } from '@/lib/formula'
import { prepareCellWrites, applyChoiceRemap, formatRejection, type FieldMeta } from '@/modules/database/services/cellWrite'
import { applyOptionAdditions } from '@/modules/database/services/cellWriteOptions'

/** Field types that can never be written through a public form submission. */
export const FORM_READONLY_TYPES = ['link_row', 'latest_comment', ...READ_ONLY_FIELD_TYPES] as const

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
  /** Whether unknown select options may be added to the field (default false). */
  canAddOptions?: boolean
}

export type CreateTableRowResult =
  | { ok: true; row: Record<string, unknown>; updatedFields?: Array<{ id: number; options: unknown }> }
  | { ok: false; error: string }

export async function createTableRow(options: CreateTableRowOptions): Promise<CreateTableRowResult> {
  const { tableId, input, username, fieldFilter, canAddOptions = false } = options

  const fields = await prisma.tableField.findMany({
    where: { tableId, deletedAt: null },
    orderBy: { order: 'asc' }
  })

  const nowStr = new Date().toISOString()

  const AUDIT_TYPES = ['created_by', 'last_modified_by', 'created_on', 'last_modified_on']
  const writable = fields.filter(f => !AUDIT_TYPES.includes(f.type) && (!fieldFilter || fieldFilter(f)))
  const fieldMetas: FieldMeta[] = writable.map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    options: typeof f.options === 'string' ? safeJsonParse(f.options, null) : f.options,
  }))
  // Fields not writable here (audit / filtered) are dropped from input, never rejected
  const writableKeys = new Set(writable.map(f => `field_${f.id}`))
  const filteredInput: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (writableKeys.has(k)) filteredInput[k] = v
  }

  const prepared = prepareCellWrites({
    fields: fieldMetas,
    input: filteredInput,
    mode: 'create',
    canAddOptions,
    actor: { username },
  })
  if (prepared.rejected.length > 0) {
    const first = prepared.rejected[0]
    const name = fields.find(f => f.id === first.fieldId)?.name ?? `field_${first.fieldId}`
    return { ok: false, error: formatRejection(name, first) }
  }

  const rowData: Record<string, unknown> = { ...prepared.data }
  for (const f of fields) {
    const key = `field_${f.id}`
    if (f.type === 'created_by' || f.type === 'last_modified_by') {
      rowData[key] = username
    } else if (f.type === 'created_on' || f.type === 'last_modified_on') {
      rowData[key] = nowStr
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

  let updatedFields: Array<{ id: number; options: unknown }> = []
  const row = await prisma.$transaction(async (tx) => {
    if (Object.keys(prepared.optionAdditions).length > 0) {
      const applied = await applyOptionAdditions(tx, tableId, prepared.optionAdditions)
      updatedFields = applied.updated.map(u => ({ ...fields.find(f => f.id === u.id), ...u }))
      Object.assign(rowData, applyChoiceRemap(rowData, fieldMetas, applied.remap))
    }
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

  return {
    ok: true,
    row: { ...row, data: safeJsonParse(row.data, {}) },
    ...(updatedFields.length > 0 ? { updatedFields } : {}),
  }
}
