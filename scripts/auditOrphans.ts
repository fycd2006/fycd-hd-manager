import prisma from '../src/lib/prisma'
import { safeJsonParse } from '../src/lib/json-utils'
import { parseLinkRowIds } from '../src/modules/database/services/linkRowSync'

async function main() {
  console.log('正在進行孤兒資料盤點中，請稍候...\n')

  // [1] 未同步軟刪除的子資料
  const deletedTables = await prisma.databaseTable.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true, name: true },
  })
  const deletedTableIds = deletedTables.map((t) => t.id)

  const unsoftDeletedRows = deletedTableIds.length > 0
    ? await prisma.tableRow.findMany({
        where: {
          tableId: { in: deletedTableIds },
          deletedAt: null,
        },
        select: { id: true, tableId: true },
      })
    : []

  const unsoftDeletedRowTableIds = Array.from(new Set(unsoftDeletedRows.map((r) => r.tableId)))

  const unsoftDeletedFields = deletedTableIds.length > 0
    ? await prisma.tableField.findMany({
        where: {
          tableId: { in: deletedTableIds },
          deletedAt: null,
        },
        select: { id: true, tableId: true },
      })
    : []
  const unsoftDeletedFieldTableIds = Array.from(new Set(unsoftDeletedFields.map((f) => f.tableId)))

  // [2] MasterViewOverride 指向已刪除或不存在的來源 TableRow
  const activeOverrides = await prisma.masterViewOverride.findMany({
    where: { deletedAt: null },
    select: { id: true, masterViewId: true, sourceTableId: true, sourceRowId: true },
  })

  const overrideSourceRowIds = Array.from(new Set(activeOverrides.map((o) => o.sourceRowId)))
  const existingSourceRows = overrideSourceRowIds.length > 0
    ? await prisma.tableRow.findMany({
        where: {
          id: { in: overrideSourceRowIds },
          deletedAt: null,
        },
        select: { id: true },
      })
    : []
  const existingSourceRowIdSet = new Set(existingSourceRows.map((r) => r.id))

  const orphanedOverrides = activeOverrides.filter((o) => !existingSourceRowIdSet.has(o.sourceRowId))
  const orphanedOverrideIds = orphanedOverrides.map((o) => o.id)

  // [3] link_row 欄位指向不存在或已刪除的 row
  const linkRowFields = await prisma.tableField.findMany({
    where: { type: 'link_row', deletedAt: null },
    select: { id: true, tableId: true, name: true, options: true },
  })

  const linkTableIds = Array.from(new Set(linkRowFields.map((f) => f.tableId)))
  const linkRows = linkTableIds.length > 0
    ? await prisma.tableRow.findMany({
        where: { tableId: { in: linkTableIds }, deletedAt: null },
        select: { id: true, tableId: true, data: true },
      })
    : []

  // Collect all target row IDs referenced in link_row columns
  const referencedTargetRowIds = new Set<number>()
  const rowsWithLinks: { rowId: number; tableId: number; fieldKey: string; targetIds: number[] }[] = []

  for (const r of linkRows) {
    const data = typeof r.data === 'string' ? safeJsonParse<Record<string, any>>(r.data, {}) : ((r.data as Record<string, any>) || {})
    const tableLinkFields = linkRowFields.filter((f) => f.tableId === r.tableId)

    for (const f of tableLinkFields) {
      const fieldKey = `field_${f.id}`
      const val = data[fieldKey]
      const targetIds = parseLinkRowIds(val)
      if (targetIds.length > 0) {
        targetIds.forEach((tid) => referencedTargetRowIds.add(tid))
        rowsWithLinks.push({ rowId: r.id, tableId: r.tableId, fieldKey, targetIds })
      }
    }
  }

  const existingTargetRows = referencedTargetRowIds.size > 0
    ? await prisma.tableRow.findMany({
        where: {
          id: { in: Array.from(referencedTargetRowIds) },
          deletedAt: null,
        },
        select: { id: true },
      })
    : []
  const existingTargetRowIdSet = new Set(existingTargetRows.map((r) => r.id))

  let orphanedLinkReferencesCount = 0
  const orphanedLinkTableIds = new Set<number>()

  for (const item of rowsWithLinks) {
    const invalidIds = item.targetIds.filter((tid) => !existingTargetRowIdSet.has(tid))
    if (invalidIds.length > 0) {
      orphanedLinkReferencesCount += invalidIds.length
      orphanedLinkTableIds.add(item.tableId)
    }
  }

  // [4] TableRow.data 殘留已刪除欄位的 key
  const deletedFields = await prisma.tableField.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true, tableId: true },
  })

  const deletedFieldKeyByTable = new Map<number, Set<string>>()
  deletedFields.forEach((df) => {
    const set = deletedFieldKeyByTable.get(df.tableId) || new Set<string>()
    set.add(`field_${df.id}`)
    deletedFieldKeyByTable.set(df.tableId, set)
  })

  const affectedTableIdsForDeletedFields = Array.from(deletedFieldKeyByTable.keys())
  const rowsInTablesWithDeletedFields = affectedTableIdsForDeletedFields.length > 0
    ? await prisma.tableRow.findMany({
        where: {
          tableId: { in: affectedTableIdsForDeletedFields },
          deletedAt: null,
        },
        select: { id: true, tableId: true, data: true },
      })
    : []

  let residualDeletedFieldKeysCount = 0
  for (const r of rowsInTablesWithDeletedFields) {
    const data = typeof r.data === 'string' ? safeJsonParse<Record<string, any>>(r.data, {}) : ((r.data as Record<string, any>) || {})
    const deletedKeys = deletedFieldKeyByTable.get(r.tableId)
    if (deletedKeys) {
      for (const k of deletedKeys) {
        if (k in data && data[k] !== undefined && data[k] !== null) {
          residualDeletedFieldKeysCount++
        }
      }
    }
  }

  const totalOrphans =
    unsoftDeletedRows.length +
    unsoftDeletedFields.length +
    orphanedOverrides.length +
    orphanedLinkReferencesCount +
    residualDeletedFieldKeysCount

  console.log('=== 孤兒資料盤點報告 ===')
  console.log('[1] 未同步軟刪除的子資料')
  console.log(
    `  - DatabaseTable 已刪除但 TableRow 未同步: ${unsoftDeletedRows.length} 筆（影響 tableId: [${unsoftDeletedRowTableIds.join(', ')}]）`
  )
  console.log(
    `  - DatabaseTable 已刪除但 TableField 未同步: ${unsoftDeletedFields.length} 筆（影響 tableId: [${unsoftDeletedFieldTableIds.join(', ')}]）`
  )
  console.log('')
  console.log('[2] MasterViewOverride 指向已刪除來源')
  console.log(
    `  - 共 ${orphanedOverrides.length} 筆，overrideId 列表: [${orphanedOverrideIds.join(', ')}]`
  )
  console.log('')
  console.log('[3] link_row 欄位指向不存在的 row')
  console.log(
    `  - 共 ${orphanedLinkReferencesCount} 筆，分布在 tableId: [${Array.from(orphanedLinkTableIds).join(', ')}]`
  )
  console.log('')
  console.log('[4] TableRow.data 殘留已刪除欄位的 key')
  console.log(`  - 共 ${residualDeletedFieldKeysCount} 筆`)
  console.log('')
  console.log(`總計預估孤兒資料筆數：${totalOrphans}`)
}

main()
  .catch((err) => {
    console.error('[auditOrphans Error]:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
