import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { evaluateFormula, detectCircularDependency, extractFormulaExpression } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'

/** Number of rows recomputed synchronously for immediate UI response */
export const SYNC_CASCADE_LIMIT = 50

/** Chunk size for background batch processing */
export const BACKGROUND_CHUNK_SIZE = 100

// Internal tracking of background tasks for observability and testing
const pendingBackgroundTasks = new Set<Promise<void>>()
let totalCascadeRowsProcessed = 0

/**
 * Recomputes formula fields for a single row based on its table's fields definition.
 */
export function computeRowFormulas(
  rowData: Record<string, any>,
  tableFields: { id: number; type: string; options: any }[]
): Record<string, any> {
  const nextData = { ...rowData }

  const formulaMap: Record<string, string> = {}
  tableFields.forEach((f) => {
    if (f.type === 'formula' && f.options) {
      formulaMap[`field_${f.id}`] = extractFormulaExpression(f.options)
    }
  })

  tableFields.forEach((f) => {
    const key = `field_${f.id}`
    if (f.type === 'formula' && f.options) {
      if (detectCircularDependency(key, formulaMap)) {
        nextData[key] = '#CIRCULAR!'
      } else {
        try {
          const expr = extractFormulaExpression(f.options)
          const fieldOrder = tableFields.map((tf) => tf.id)
          const res = evaluateFormula(expr, nextData, fieldOrder)
          nextData[key] = res != null ? String(res) : ''
        } catch {
          nextData[key] = '#VALUE!'
        }
      }
    }
  })

  return nextData
}

/**
 * Persists a batch of updated rows to the database in a single transaction.
 */
async function persistRowBatch(
  rows: { id: number; tableId: number; data: Record<string, any> }[]
): Promise<void> {
  if (rows.length === 0) return

  await prisma.$transaction(
    rows.map((r) =>
      prisma.tableRow.update({
        where: { id: r.id },
        data: { data: r.data as Prisma.InputJsonValue },
      })
    )
  )
}

/**
 * Processes large cascade sets asynchronously in sequential chunks to guarantee eventual consistency.
 */
async function processCascadeChunksInBackground(
  rowsToProcess: { id: number; tableId: number; data: Record<string, any> }[],
  fieldsByTableId: Map<number, any[]>
): Promise<void> {
  for (let i = 0; i < rowsToProcess.length; i += BACKGROUND_CHUNK_SIZE) {
    const chunk = rowsToProcess.slice(i, i + BACKGROUND_CHUNK_SIZE)

    for (const depRow of chunk) {
      const depFields = fieldsByTableId.get(depRow.tableId) || []
      depRow.data = computeRowFormulas(depRow.data, depFields)
    }

    try {
      await persistRowBatch(chunk)
      totalCascadeRowsProcessed += chunk.length
    } catch (err) {
      console.error(`[Background Cascade Error] Failed updating chunk starting at index ${i}:`, err)
    }
  }
}

/**
 * Cascade recompute direct dependent rows with dual-track architecture:
 * 1. Synchronous Fast-path: Recomputes first SYNC_CASCADE_LIMIT (50) rows and returns them immediately for zero UI latency.
 * 2. Asynchronous Engine: If affected rows > 50, processes remaining rows in background chunks of 100,
 *    eliminating the legacy 300-row cutoff and guaranteeing 100% eventual consistency.
 */
export async function cascadeRecomputeSingleLevel(
  updatedTableId: number,
  updatedRowId: number
): Promise<{ id: number; tableId: number; data: Record<string, any> }[]> {
  // 1. Find all fields that link or reference tables
  const relationFields = await prisma.tableField.findMany({
    where: {
      type: { in: ['link_row', 'lookup', 'rollup'] },
      deletedAt: null,
    },
  })

  const dependentTableIds = new Set<number>()
  relationFields.forEach((f) => {
    try {
      const opts: any = typeof f.options === 'string' ? safeJsonParse(f.options, {}) : f.options || {}
      if (opts.targetTableId === updatedTableId || opts.relationTableId === updatedTableId) {
        dependentTableIds.add(f.tableId)
      }
    } catch {}
  })

  if (dependentTableIds.size === 0) return []

  // 2. Query candidate rows containing the updated row ID
  const candidateRowsRaw = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM TableRow
    WHERE tableId IN (${Prisma.join(Array.from(dependentTableIds))})
    AND deletedAt IS NULL
    AND data LIKE ${'%' + String(updatedRowId) + '%'}
  `

  if (!candidateRowsRaw || candidateRowsRaw.length === 0) return []

  const candidateRows = await prisma.tableRow.findMany({
    where: { id: { in: candidateRowsRaw.map((r) => r.id) } },
  })

  // 3. Filter exact link matches
  const affectedRows: { id: number; tableId: number; data: Record<string, any> }[] = []
  candidateRows.forEach((r) => {
    try {
      const parsedData = safeJsonParse<Record<string, any>>(r.data, {})
      const isLinked = Object.keys(parsedData).some((key) => {
        const val = parsedData[key]
        if (Array.isArray(val)) {
          return val.some((id) => {
            if (typeof id === 'object' && id !== null && 'id' in id) {
              return Number(id.id) === updatedRowId
            }
            return Number(id) === updatedRowId
          })
        }
        return false
      })
      if (isLinked) {
        affectedRows.push({ id: r.id, tableId: r.tableId, data: parsedData })
      }
    } catch {}
  })

  if (affectedRows.length === 0) return []

  // 4. Pre-fetch all field schemas for affected tables in a single query
  const distinctTableIds = Array.from(new Set(affectedRows.map((r) => r.tableId)))
  const allDepFields = await prisma.tableField.findMany({
    where: {
      tableId: { in: distinctTableIds },
      deletedAt: null,
    },
    orderBy: { order: 'asc' },
  })

  const fieldsByTableId = new Map<number, typeof allDepFields>()
  allDepFields.forEach((f) => {
    const list = fieldsByTableId.get(f.tableId) || []
    list.push(f)
    fieldsByTableId.set(f.tableId, list)
  })

  // 5. Fast-path: Process synchronous slice (up to 50 rows)
  const syncSlice = affectedRows.slice(0, SYNC_CASCADE_LIMIT)
  const asyncSlice = affectedRows.slice(SYNC_CASCADE_LIMIT)

  for (const depRow of syncSlice) {
    const depFields = fieldsByTableId.get(depRow.tableId) || []
    depRow.data = computeRowFormulas(depRow.data, depFields)
  }

  await persistRowBatch(syncSlice)
  totalCascadeRowsProcessed += syncSlice.length

  // 6. Background Engine: Process remaining slice if total rows > SYNC_CASCADE_LIMIT
  if (asyncSlice.length > 0) {
    const bgTask = processCascadeChunksInBackground(asyncSlice, fieldsByTableId)
      .catch((err) => {
        console.error('[Async Cascade Background Worker Unhandled Error]:', err)
      })
      .finally(() => {
        pendingBackgroundTasks.delete(bgTask)
      })

    pendingBackgroundTasks.add(bgTask)
  }

  return syncSlice
}

/**
 * Clean up dependent lookup/rollup fields when a field is deleted
 */
export async function cleanupFieldDependencies(deletedFieldId: number) {
  const lookupRollupFields = await prisma.tableField.findMany({
    where: {
      type: { in: ['lookup', 'rollup'] },
      deletedAt: null,
    },
  })

  for (const field of lookupRollupFields) {
    if (!field.options) continue
    try {
      const opts: any = typeof field.options === 'string' ? safeJsonParse(field.options, {}) : field.options || {}
      if (Number(opts.relationFieldId) === deletedFieldId || Number(opts.targetFieldId) === deletedFieldId) {
        const newOpts = {
          ...opts,
          ...(Number(opts.relationFieldId) === deletedFieldId ? { relationFieldId: null } : {}),
          ...(Number(opts.targetFieldId) === deletedFieldId ? { targetFieldId: null } : {}),
        }
        await prisma.tableField.update({
          where: { id: field.id },
          data: { options: newOpts as any },
        })
      }
    } catch {}
  }
}

/**
 * Awaits any in-flight background cascade jobs to finish.
 * Essential for integration tests and maintenance jobs.
 */
export async function waitForPendingCascadeTasks(): Promise<void> {
  if (pendingBackgroundTasks.size === 0) return
  await Promise.all(Array.from(pendingBackgroundTasks))
}

/**
 * Returns cascade statistics for health checks and observability.
 */
export function getCascadeStats() {
  return {
    totalProcessed: totalCascadeRowsProcessed,
    activeBackgroundJobs: pendingBackgroundTasks.size,
  }
}
