import fs from 'fs'
import path from 'path'
import readline from 'readline'
import prisma from '../src/lib/prisma'
import { safeJsonParse } from '../src/lib/json-utils'
import { parseLinkRowIds } from '../src/modules/database/services/linkRowSync'

interface OrphanLinkItem {
  tableId: number
  rowId: number
  fieldId: number
  fieldKey: string
  fieldName: string
  invalidTargetIds: number[]
  originalValue: any
  cleanedValue: any
  originalData: Record<string, any>
  cleanedData: Record<string, any>
}

async function promptConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'yes')
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  const isExecute = args.includes('--execute')
  const isDryRun = !isExecute || args.includes('--dry-run')

  console.log(`\n=== link_row 孤兒關聯清理工具 ===`)
  console.log(`模式: ${isDryRun ? '🔍 預覽模式 (DRY RUN - 不會修改資料庫)' : '⚡ 執行模式 (EXECUTE - 將寫入資料庫)'}\n`)

  // 1. 取得所有有效的 link_row 欄位
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

  // 2. 收集所有 link_row 欄位中引用的 targetRowId
  const referencedTargetRowIds = new Set<number>()
  for (const r of linkRows) {
    const data = typeof r.data === 'string' ? safeJsonParse<Record<string, any>>(r.data, {}) : ((r.data as Record<string, any>) || {})
    const tableLinkFields = linkRowFields.filter((f) => f.tableId === r.tableId)

    for (const f of tableLinkFields) {
      const fieldKey = `field_${f.id}`
      const val = data[fieldKey]
      const targetIds = parseLinkRowIds(val)
      targetIds.forEach((tid) => referencedTargetRowIds.add(tid))
    }
  }

  // 3. 查詢目前資料庫中真實存在且未軟刪除的 TableRow
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

  // 4. 掃描並過濾孤兒引用
  const orphanItems: OrphanLinkItem[] = []
  let totalInvalidTargetReferences = 0

  for (const r of linkRows) {
    const data = typeof r.data === 'string' ? safeJsonParse<Record<string, any>>(r.data, {}) : ((r.data as Record<string, any>) || {})
    const tableLinkFields = linkRowFields.filter((f) => f.tableId === r.tableId)

    let rowHasOrphans = false
    const nextData = { ...data }

    for (const f of tableLinkFields) {
      const fieldKey = `field_${f.id}`
      const originalVal = data[fieldKey]
      const targetIds = parseLinkRowIds(originalVal)
      if (targetIds.length === 0) continue

      const invalidIds = targetIds.filter((tid) => !existingTargetRowIdSet.has(tid))
      if (invalidIds.length > 0) {
        rowHasOrphans = true
        totalInvalidTargetReferences += invalidIds.length

        // 清理無效的 targetId
        let cleanedVal: any
        if (Array.isArray(originalVal)) {
          cleanedVal = originalVal.filter((item: any) => {
            const num = typeof item === 'object' && item !== null ? Number(item.id) : Number(item)
            return existingTargetRowIdSet.has(num)
          })
        } else if (typeof originalVal === 'string') {
          // 如果是字串或單一值，轉成過濾後的陣列
          const validIds = targetIds.filter((tid) => existingTargetRowIdSet.has(tid))
          cleanedVal = validIds.length === 1 ? validIds[0] : validIds
        } else {
          cleanedVal = []
        }

        nextData[fieldKey] = cleanedVal

        orphanItems.push({
          tableId: r.tableId,
          rowId: r.id,
          fieldId: f.id,
          fieldKey,
          fieldName: f.name,
          invalidTargetIds: invalidIds,
          originalValue: originalVal,
          cleanedValue: cleanedVal,
          originalData: data,
          cleanedData: nextData,
        })
      }
    }
  }

  console.log(`掃描統計：`)
  console.log(`- 影響資料列 (TableRow) 筆數: ${new Set(orphanItems.map((i) => i.rowId)).size} 列`)
  console.log(`- 發現失效 target row 引用: ${totalInvalidTargetReferences} 筆 (涵蓋 ${orphanItems.length} 個欄位實例)\n`)

  if (orphanItems.length === 0) {
    console.log('🎉 目前沒有發現任何 link_row 孤兒關聯！')
    return
  }

  // 5. 印出清單明細 (前 20 筆與總結)
  console.log(`--- 孤兒關聯詳細清單 (前 20 筆) ---`)
  orphanItems.slice(0, 20).forEach((item, idx) => {
    console.log(
      `[#${idx + 1}] tableId: ${item.tableId}, rowId: ${item.rowId}, 欄位: ${item.fieldName} (${item.fieldKey}), 移除失效 ID: [${item.invalidTargetIds.join(', ')}]`
    )
  })
  if (orphanItems.length > 20) {
    console.log(`... 還有其餘 ${orphanItems.length - 20} 筆`)
  }
  console.log('----------------------------------\n')

  if (isDryRun) {
    console.log(`💡 [DRY RUN 結束] 資料庫未作任何變更。`)
    console.log(`如需真正執行清理，請執行: npx tsx scripts/cleanOrphanLinks.ts --execute`)
    return
  }

  // 6. 執行清理前確認
  const autoConfirm = args.includes('--yes') || args.includes('-y')
  const confirmed = autoConfirm || (await promptConfirmation(
    `⚠️  請確認是否要執行清理並更新這 ${orphanItems.length} 個欄位資料？請輸入 "yes" 確認: `
  ))

  if (!confirmed) {
    console.log('已取消執行。')
    return
  }

  // 7. 建立 logs 資料夾並記錄 rollback log
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFilePath = path.join(logDir, `cleanOrphanLinks-${timestamp}.json`)

  // 合併同一 rowId 的多次變更
  const rowUpdatesMap = new Map<number, { tableId: number; rowId: number; before: any; after: any }>()
  for (const item of orphanItems) {
    const existing = rowUpdatesMap.get(item.rowId)
    if (!existing) {
      rowUpdatesMap.set(item.rowId, {
        tableId: item.tableId,
        rowId: item.rowId,
        before: item.originalData,
        after: item.cleanedData,
      })
    } else {
      existing.after = { ...existing.after, ...item.cleanedData }
    }
  }

  const updatesList = Array.from(rowUpdatesMap.values())

  fs.writeFileSync(
    logFilePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalOrphanReferencesCleaned: totalInvalidTargetReferences,
        affectedRowsCount: updatesList.length,
        changes: updatesList,
      },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`\n📝 已儲存備份與清理記錄檔: ${logFilePath}`)

  // 8. 分批 Transaction 寫入 (每批 50 筆)
  const BATCH_SIZE = 50
  console.log(`開始批次更新資料庫 (Batch size: ${BATCH_SIZE})...`)

  for (let i = 0; i < updatesList.length; i += BATCH_SIZE) {
    const batch = updatesList.slice(i, i + BATCH_SIZE)
    await prisma.$transaction(
      batch.map((b) =>
        prisma.tableRow.update({
          where: { id: b.rowId },
          data: { data: b.after },
        })
      )
    )
    console.log(`✓ 已完成 ${Math.min(i + BATCH_SIZE, updatesList.length)} / ${updatesList.length} 列更新`)
  }

  console.log(`\n🎉 孤兒關聯清理完成！共清理 ${totalInvalidTargetReferences} 筆失效引用。`)
}

main()
  .catch((err) => {
    console.error('[cleanOrphanLinks Error]:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
