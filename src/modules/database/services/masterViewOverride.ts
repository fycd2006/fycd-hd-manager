import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { safeJsonParse } from '@/lib/json-utils'
import type { MultiTableParsedRow } from './multiTableQuery'
import { invalidateMasterViewCacheForTable } from './masterViewCache'

export interface MasterViewOverrideInput {
  masterViewId: number
  sourceTableId: number
  sourceRowId: number
  overrides: Record<string, any>
}

export interface MasterViewRowWithOverrides extends MultiTableParsedRow {
  _hasOverride?: boolean
  _overrideKeys?: string[]
  _originalData?: Record<string, any>
  _overrideUpdatedAt?: string
  _overrideUpdatedBy?: string
  _isStaleOverride?: boolean
}

/**
 * Upserts a row override for a specific master view.
 * Ensures idempotency and safe concurrency (last write wins).
 */
export async function upsertMasterViewOverride(input: MasterViewOverrideInput) {
  const { masterViewId, sourceTableId, sourceRowId, overrides } = input

  if (!masterViewId || !sourceTableId || !sourceRowId) {
    throw new Error('缺少必要的 masterViewId, sourceTableId, 或 sourceRowId 參數')
  }

  const existing = await prisma.masterViewOverride.findUnique({
    where: {
      masterViewId_sourceTableId_sourceRowId: {
        masterViewId,
        sourceTableId,
        sourceRowId,
      },
    },
  })

  const existingOverrides =
    existing && !existing.deletedAt
      ? safeJsonParse<Record<string, any>>(existing.overrides, {})
      : {}

  const mergedOverrides = { ...existingOverrides, ...overrides }

  const result = await prisma.masterViewOverride.upsert({
    where: {
      masterViewId_sourceTableId_sourceRowId: {
        masterViewId,
        sourceTableId,
        sourceRowId,
      },
    },
    create: {
      masterViewId,
      sourceTableId,
      sourceRowId,
      overrides: mergedOverrides as Prisma.InputJsonValue,
      deletedAt: null,
    },
    update: {
      overrides: mergedOverrides as Prisma.InputJsonValue,
      deletedAt: null,
      updatedAt: new Date(),
    },
  })


  try {
    await invalidateMasterViewCacheForTable(sourceTableId)
  } catch (cacheErr) {
    console.warn(`[MasterViewCache Warning on upsertOverride for table ${sourceTableId}]:`, cacheErr)
  }

  return {
    ...result,
    overrides: safeJsonParse<Record<string, any>>(result.overrides, {}),
  }
}

/**
 * Merges MasterViewOverride entries into a page of virtual master view rows.
 * Batch-queries all overrides for the current page in O(1) query.
 */
export async function mergeMasterViewOverrides(
  masterViewId: number,
  rows: MultiTableParsedRow[]
): Promise<MasterViewRowWithOverrides[]> {
  if (!rows || rows.length === 0) {
    return []
  }

  // 1. Build lookup keys
  const lookupConditions = rows.map((r) => ({
    sourceTableId: r.tableId,
    sourceRowId: r.id,
  }))

  // 2. Batch fetch active overrides for this master view
  const overrides = await prisma.masterViewOverride.findMany({
    where: {
      masterViewId,
      deletedAt: null,
      OR: lookupConditions,
    },
  })

  if (overrides.length === 0) {
    return rows.map((r) => ({ ...r, _hasOverride: false }))
  }

  // 3. Map overrides by `${sourceTableId}-${sourceRowId}`
  const overrideMap = new Map<string, { overrides: Record<string, any>; updatedAt: Date }>()
  for (const item of overrides) {
    const key = `${item.sourceTableId}-${item.sourceRowId}`
    overrideMap.set(key, {
      overrides: safeJsonParse<Record<string, any>>(item.overrides, {}),
      updatedAt: item.updatedAt,
    })
  }

  // 4. Merge overrides into row data
  return rows.map((row) => {
    const key = `${row.tableId}-${row.id}`
    const item = overrideMap.get(key)

    if (!item || Object.keys(item.overrides).length === 0) {
      return { ...row, _hasOverride: false }
    }

    const overrideData = item.overrides
    const originalData = { ...row.data }
    const mergedData = { ...row.data, ...overrideData }
    const overrideKeys = Object.keys(overrideData)

    const rowUpdatedAt = (row as any).updatedAt ? new Date((row as any).updatedAt) : null
    const isStale = !!(rowUpdatedAt && item.updatedAt && rowUpdatedAt.getTime() > item.updatedAt.getTime() + 1000)

    return {
      ...row,
      data: mergedData,
      _hasOverride: true,
      _overrideKeys: overrideKeys,
      _originalData: originalData,
      _overrideUpdatedAt: item.updatedAt ? item.updatedAt.toISOString() : undefined,
      _isStaleOverride: isStale,
    }
  })
}


/**
 * Cascade soft-deletes any MasterViewOverride records when the underlying source row is deleted.
 */
export async function softDeleteMasterViewOverrides(sourceTableId: number, sourceRowId: number) {
  if (!sourceTableId || !sourceRowId) return { count: 0 }

  const res = await prisma.masterViewOverride.updateMany({
    where: {
      sourceTableId,
      sourceRowId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  })

  try {
    await invalidateMasterViewCacheForTable(sourceTableId)
  } catch (cacheErr) {
    console.warn(`[MasterViewCache Warning on softDeleteOverride for table ${sourceTableId}]:`, cacheErr)
  }

  return res
}

export interface MasterViewOverrideRevertInput {
  masterViewId: number
  sourceTableId: number
  sourceRowId: number
  fieldKey?: string // If provided, only revert this specific field; otherwise revert entire row override
}

/**
 * Reverts a specific field or all overrides for a row in a master view.
 */
export async function revertMasterViewOverride(input: MasterViewOverrideRevertInput) {
  const { masterViewId, sourceTableId, sourceRowId, fieldKey } = input

  if (!masterViewId || !sourceTableId || !sourceRowId) {
    throw new Error('缺少必要的 masterViewId, sourceTableId, 或 sourceRowId 參數')
  }

  const existing = await prisma.masterViewOverride.findUnique({
    where: {
      masterViewId_sourceTableId_sourceRowId: {
        masterViewId,
        sourceTableId,
        sourceRowId,
      },
    },
  })

  if (!existing || existing.deletedAt) {
    return { success: true, count: 0 }
  }

  if (!fieldKey) {
    // Soft delete entire override record
    await prisma.masterViewOverride.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    })

    try {
      await invalidateMasterViewCacheForTable(sourceTableId)
    } catch (cacheErr) {
      console.warn(`[MasterViewCache Warning on revertOverride for table ${sourceTableId}]:`, cacheErr)
    }

    return { success: true, count: 1 }
  }

  const currentOverrides = safeJsonParse<Record<string, any>>(existing.overrides, {})
  delete currentOverrides[fieldKey]

  if (Object.keys(currentOverrides).length === 0) {
    await prisma.masterViewOverride.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    })
  } else {
    await prisma.masterViewOverride.update({
      where: { id: existing.id },
      data: {
        overrides: currentOverrides as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    })
  }

  try {
    await invalidateMasterViewCacheForTable(sourceTableId)
  } catch (cacheErr) {
    console.warn(`[MasterViewCache Warning on revertOverride for table ${sourceTableId}]:`, cacheErr)
  }

  return { success: true, count: 1, remainingOverrides: currentOverrides }
}

export interface BatchRevertItem {
  sourceTableId: number
  sourceRowId: number
  fieldKey?: string
}

/**
 * Batch-reverts overrides for multiple rows/fields in a master view.
 * Performs a single updateMany for whole-row reverts and groups cache invalidations.
 */
export async function revertBatchMasterViewOverrides(
  masterViewId: number,
  items: BatchRevertItem[]
): Promise<{ success: boolean; count: number }> {
  if (!masterViewId || !Array.isArray(items) || items.length === 0) {
    return { success: true, count: 0 }
  }

  // Separate full row reverts vs specific field reverts
  const fullRowItems = items.filter((item) => !item.fieldKey && item.sourceTableId && item.sourceRowId)
  const fieldSpecificItems = items.filter((item) => item.fieldKey && item.sourceTableId && item.sourceRowId)

  let totalRevertedCount = 0
  const affectedTableIds = new Set<number>()

  // 1. Batch soft-delete full row overrides in a single updateMany
  if (fullRowItems.length > 0) {
    const lookupConditions = fullRowItems.map((item) => ({
      sourceTableId: item.sourceTableId,
      sourceRowId: item.sourceRowId,
    }))

    const updateRes = await prisma.masterViewOverride.updateMany({
      where: {
        masterViewId,
        deletedAt: null,
        OR: lookupConditions,
      },
      data: {
        deletedAt: new Date(),
      },
    })

    totalRevertedCount += updateRes.count
    fullRowItems.forEach((item) => affectedTableIds.add(item.sourceTableId))
  }

  // 2. Handle field-specific reverts sequentially/via transaction
  for (const item of fieldSpecificItems) {
    const res = await revertMasterViewOverride({
      masterViewId,
      sourceTableId: item.sourceTableId,
      sourceRowId: item.sourceRowId,
      fieldKey: item.fieldKey,
    })
    if (res.count) {
      totalRevertedCount += res.count
    }
    affectedTableIds.add(item.sourceTableId)
  }

  // 3. Invalidate cache for all affected tables
  for (const tableId of affectedTableIds) {
    try {
      await invalidateMasterViewCacheForTable(tableId)
    } catch (cacheErr) {
      console.warn(`[MasterViewCache Warning on batchRevertOverrides for table ${tableId}]:`, cacheErr)
    }
  }

  return { success: true, count: totalRevertedCount }
}

