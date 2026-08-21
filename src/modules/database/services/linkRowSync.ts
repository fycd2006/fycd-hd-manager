import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { cascadeRecomputeSingleLevel } from './rowCascade'

/**
 * Parses raw cell value into number array of target row IDs
 */
export function parseLinkRowIds(val: any): number[] {
  if (val === null || val === undefined) return []
  let list: any[] = []
  if (Array.isArray(val)) {
    list = val
  } else if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) list = parsed
      else list = [parsed]
    } catch {
      list = val.split(',').map(s => s.trim()).filter(Boolean)
    }
  } else {
    list = [val]
  }
  return list
    .map(item => {
      if (typeof item === 'object' && item !== null) {
        return Number(item.id)
      }
      return Number(item)
    })
    .filter(n => !isNaN(n) && n > 0)
}

export interface LinkSyncResult {
  targetTableId: number
  /** Target rows whose reverse link field was actually modified. */
  rowIds: number[]
}

/**
 * Synchronizes bi-directional link_row relations between source and target tables.
 * When row A links row B, row B's reverse link_row field is automatically updated with row A.
 * Returns the affected target rows so callers can emit realtime events; null when no-op.
 */
export async function syncBiDirectionalLinkRow(
  sourceTableId: number,
  sourceRowId: number,
  fieldId: number,
  newTargetRowIds: number[],
  oldTargetRowIds: number[] = []
): Promise<LinkSyncResult | null> {
  // 1. Get the source field definition to check for reverse link field options
  const sourceField = await prisma.tableField.findUnique({
    where: { id: fieldId },
  })

  if (!sourceField || sourceField.type !== 'link_row') return null

  let opts: any = sourceField.options || {}
  try {
    if (typeof opts === 'string') opts = JSON.parse(opts)
  } catch {}

  const relatedFieldId = opts.relatedFieldId ? Number(opts.relatedFieldId) : null
  const targetTableId = opts.targetTableId ? Number(opts.targetTableId) : null

  if (!relatedFieldId || !targetTableId) return null

  // Verify the related field exists on target table
  const relatedField = await prisma.tableField.findUnique({
    where: { id: relatedFieldId, tableId: targetTableId, deletedAt: null },
  })

  if (!relatedField) return null

  const relatedFieldKey = `field_${relatedFieldId}`

  // Calculate added and removed target row IDs
  const oldSet = new Set(oldTargetRowIds)
  const newSet = new Set(newTargetRowIds)

  const addedTargetRowIds = newTargetRowIds.filter(id => !oldSet.has(id))
  const removedTargetRowIds = oldTargetRowIds.filter(id => !newSet.has(id))

  if (addedTargetRowIds.length === 0 && removedTargetRowIds.length === 0) return null

  // Handle Added Relations -> Insert sourceRowId into target row's relatedFieldKey as pure ID array
  const modifiedRowIds: number[] = []

  if (addedTargetRowIds.length > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: addedTargetRowIds }, tableId: targetTableId, deletedAt: null },
    })

    for (const tRow of targetRows) {
      let tData: Record<string, any> = typeof tRow.data === 'string' ? JSON.parse(tRow.data || '{}') : (tRow.data as any || {})

      const existingValues = tData[relatedFieldKey]
      const currentIds = parseLinkRowIds(existingValues)

      if (!currentIds.includes(sourceRowId)) {
        const updatedList: number[] = [...currentIds, sourceRowId]
        tData[relatedFieldKey] = updatedList

        await prisma.tableRow.update({
          where: { id: tRow.id },
          data: { data: tData as any },
        })
        modifiedRowIds.push(tRow.id)

        // Cascade recompute for target table dependencies
        try {
          await cascadeRecomputeSingleLevel(targetTableId, tRow.id)
        } catch {}
      }
    }
  }

  // Handle Removed Relations -> Filter out sourceRowId from target row's relatedFieldKey as pure ID array
  if (removedTargetRowIds.length > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: removedTargetRowIds }, tableId: targetTableId, deletedAt: null },
    })

    for (const tRow of targetRows) {
      let tData: Record<string, any> = typeof tRow.data === 'string' ? JSON.parse(tRow.data || '{}') : (tRow.data as any || {})

      const existingValues = tData[relatedFieldKey]
      const currentIds = parseLinkRowIds(existingValues)

      if (currentIds.includes(sourceRowId)) {
        const updatedList: number[] = currentIds.filter(id => id !== sourceRowId)
        tData[relatedFieldKey] = updatedList

        await prisma.tableRow.update({
          where: { id: tRow.id },
          data: { data: tData as any },
        })
        modifiedRowIds.push(tRow.id)

        // Cascade recompute for target table dependencies
        try {
          await cascadeRecomputeSingleLevel(targetTableId, tRow.id)
        } catch {}
      }
    }
  }

  return { targetTableId, rowIds: modifiedRowIds }
}

/**
 * Removes all inbound link_row references pointing to targetRowId across all tables.
 * Can be executed inside an existing Prisma transaction.
 */
export async function cleanupInboundLinkRowReferences(
  targetRowId: number,
  txClient?: Prisma.TransactionClient
): Promise<number> {
  const db = txClient || prisma

  const linkRowFields = await db.tableField.findMany({
    where: { type: 'link_row', deletedAt: null },
    select: { id: true, tableId: true },
  })

  if (linkRowFields.length === 0) return 0

  const tableIds = Array.from(new Set(linkRowFields.map((f) => f.tableId)))
  const rows = await db.tableRow.findMany({
    where: { tableId: { in: tableIds }, deletedAt: null },
    select: { id: true, tableId: true, data: true },
  })

  let cleanedCount = 0

  for (const r of rows) {
    const data = typeof r.data === 'string' ? JSON.parse(r.data || '{}') : ((r.data as Record<string, any>) || {})
    const tableFields = linkRowFields.filter((f) => f.tableId === r.tableId)
    let modified = false

    for (const f of tableFields) {
      const fieldKey = `field_${f.id}`
      const val = data[fieldKey]
      const targetIds = parseLinkRowIds(val)
      if (targetIds.includes(targetRowId)) {
        modified = true
        cleanedCount++
        data[fieldKey] = targetIds.filter((id) => id !== targetRowId)
      }
    }

    if (modified) {
      await db.tableRow.update({
        where: { id: r.id },
        data: { data: data as Prisma.InputJsonValue },
      })
    }
  }

  return cleanedCount
}

/**
 * Cleanup reverse link references when a source row is deleted
 */
export async function cleanupRowLinkRowRelations(
  sourceTableId: number,
  sourceRowId: number,
  txClient?: Prisma.TransactionClient
) {
  const db = txClient || prisma
  const linkRowFields = await db.tableField.findMany({
    where: { tableId: sourceTableId, type: 'link_row', deletedAt: null },
  })

  if (linkRowFields.length === 0) return

  const sourceRow = await db.tableRow.findUnique({
    where: { id: sourceRowId },
  })

  if (!sourceRow?.data) return

  let sData: Record<string, any> = typeof sourceRow.data === 'string' ? JSON.parse(sourceRow.data) : (sourceRow.data as any || {})

  for (const field of linkRowFields) {
    const rawVal = sData[`field_${field.id}`]
    const targetIds = parseLinkRowIds(rawVal)
    if (targetIds.length > 0) {
      await syncBiDirectionalLinkRow(sourceTableId, sourceRowId, field.id, [], targetIds)
    }
  }
}
