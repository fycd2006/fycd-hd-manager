import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { safeJsonParse } from '@/lib/json-utils'
import type { MultiTableParsedRow } from './multiTableQuery'

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
      overrides: overrides as Prisma.InputJsonValue,
      deletedAt: null,
    },
    update: {
      overrides: overrides as Prisma.InputJsonValue,
      deletedAt: null,
      updatedAt: new Date(),
    },
  })

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

  return prisma.masterViewOverride.updateMany({
    where: {
      sourceTableId,
      sourceRowId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  })
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

  return { success: true, count: 1, remainingOverrides: currentOverrides }
}
