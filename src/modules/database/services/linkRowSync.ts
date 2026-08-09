import prisma from '@/lib/prisma'
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

/**
 * Synchronizes bi-directional link_row relations between source and target tables.
 * When row A links row B, row B's reverse link_row field is automatically updated with row A.
 */
export async function syncBiDirectionalLinkRow(
  sourceTableId: number,
  sourceRowId: number,
  fieldId: number,
  newTargetRowIds: number[],
  oldTargetRowIds: number[] = []
) {
  // 1. Get the source field definition to check for reverse link field options
  const sourceField = await prisma.tableField.findUnique({
    where: { id: fieldId },
  })

  if (!sourceField || sourceField.type !== 'link_row') return

  let opts: any = sourceField.options || {}
  try {
    if (typeof opts === 'string') opts = JSON.parse(opts)
  } catch {}

  const relatedFieldId = opts.relatedFieldId ? Number(opts.relatedFieldId) : null
  const targetTableId = opts.targetTableId ? Number(opts.targetTableId) : null

  if (!relatedFieldId || !targetTableId) return

  // Verify the related field exists on target table
  const relatedField = await prisma.tableField.findUnique({
    where: { id: relatedFieldId, tableId: targetTableId, deletedAt: null },
  })

  if (!relatedField) return

  const relatedFieldKey = `field_${relatedFieldId}`

  // Calculate added and removed target row IDs
  const oldSet = new Set(oldTargetRowIds)
  const newSet = new Set(newTargetRowIds)

  const addedTargetRowIds = newTargetRowIds.filter(id => !oldSet.has(id))
  const removedTargetRowIds = oldTargetRowIds.filter(id => !newSet.has(id))

  if (addedTargetRowIds.length === 0 && removedTargetRowIds.length === 0) return

  // Fetch primary value or label for sourceRowId
  const sourceRow = await prisma.tableRow.findUnique({
    where: { id: sourceRowId },
  })

  let sourceLabel = `列 ID: ${sourceRowId}`
  if (sourceRow?.data) {
    try {
      const sData: any = typeof sourceRow.data === 'string' ? JSON.parse(sourceRow.data) : (sourceRow.data || {})
      const primaryField = await prisma.tableField.findFirst({
        where: { tableId: sourceTableId, deletedAt: null },
        orderBy: { order: 'asc' },
      })
      if (primaryField && sData[`field_${primaryField.id}`] != null) {
        sourceLabel = String(sData[`field_${primaryField.id}`])
      }
    } catch {}
  }

  // Handle Added Relations -> Insert sourceRowId into target row's relatedFieldKey
  if (addedTargetRowIds.length > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: addedTargetRowIds }, tableId: targetTableId, deletedAt: null },
    })

    for (const tRow of targetRows) {
      let tData: Record<string, any> = typeof tRow.data === 'string' ? JSON.parse(tRow.data || '{}') : (tRow.data as any || {})

      const existingValues = tData[relatedFieldKey]
      const currentIds = parseLinkRowIds(existingValues)

      if (!currentIds.includes(sourceRowId)) {
        let updatedList: any[] = Array.isArray(existingValues) ? [...existingValues] : []
        updatedList.push({ id: sourceRowId, value: sourceLabel })

        tData[relatedFieldKey] = updatedList

        await prisma.tableRow.update({
          where: { id: tRow.id },
          data: { data: tData as any },
        })

        // Cascade recompute for target table dependencies
        try {
          await cascadeRecomputeSingleLevel(targetTableId, tRow.id)
        } catch {}
      }
    }
  }

  // Handle Removed Relations -> Filter out sourceRowId from target row's relatedFieldKey
  if (removedTargetRowIds.length > 0) {
    const targetRows = await prisma.tableRow.findMany({
      where: { id: { in: removedTargetRowIds }, tableId: targetTableId, deletedAt: null },
    })

    for (const tRow of targetRows) {
      let tData: Record<string, any> = typeof tRow.data === 'string' ? JSON.parse(tRow.data || '{}') : (tRow.data as any || {})

      const existingValues = tData[relatedFieldKey]
      const currentIds = parseLinkRowIds(existingValues)

      if (currentIds.includes(sourceRowId)) {
        let updatedList: any[] = []
        if (Array.isArray(existingValues)) {
          updatedList = existingValues.filter((item: any) => {
            const itemNum = typeof item === 'object' && item !== null ? Number(item.id) : Number(item)
            return itemNum !== sourceRowId
          })
        }

        tData[relatedFieldKey] = updatedList

        await prisma.tableRow.update({
          where: { id: tRow.id },
          data: { data: tData as any },
        })

        // Cascade recompute for target table dependencies
        try {
          await cascadeRecomputeSingleLevel(targetTableId, tRow.id)
        } catch {}
      }
    }
  }
}

/**
 * Cleanup reverse link references when a source row is deleted
 */
export async function cleanupRowLinkRowRelations(sourceTableId: number, sourceRowId: number) {
  const linkRowFields = await prisma.tableField.findMany({
    where: { tableId: sourceTableId, type: 'link_row', deletedAt: null },
  })

  if (linkRowFields.length === 0) return

  const sourceRow = await prisma.tableRow.findUnique({
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
