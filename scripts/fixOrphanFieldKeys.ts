import fs from 'fs'
import path from 'path'
import readline from 'readline'
import prisma from '../src/lib/prisma'
import { safeJsonParse } from '../src/lib/json-utils'

interface OrphanKeyItem {
  tableId: number
  rowId: number
  deletedFieldId: number
  fieldKey: string
  fieldName: string
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
  const autoConfirm = args.includes('--yes') || args.includes('-y')

  console.log(`\n=== TableRow 殘留已刪除欄位 Key 清理工具 ===`)
  console.log(`模式: ${isDryRun ? '🔍 預覽模式 (DRY RUN - 不會修改資料庫)' : '⚡ 執行模式 (EXECUTE - 將寫入資料庫)'}\n`)

  // 1. 取得所有已被軟刪除的 TableField
  const deletedFields = await prisma.tableField.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true, tableId: true, name: true, deletedAt: true },
  })

  if (deletedFields.length === 0) {
    console.log('目前沒有任何已刪除的 TableField。')
    return
  }

  // 建立 tableId -> deleted fields map
  const deletedFieldsByTable = new Map<number, typeof deletedFields>()
  deletedFields.forEach((df) => {
    const list = deletedFieldsByTable.get(df.tableId) || []
    list.push(df)
    deletedFieldsByTable.set(df.tableId, list)
  })

  const affectedTableIds = Array.from(deletedFieldsByTable.keys())

  // 2. 查詢這些表格的所有 TableRow (包含未刪除的列)
  const rows = await prisma.tableRow.findMany({
    where: { tableId: { in: affectedTableIds }, deletedAt: null },
    select: { id: true, tableId: true, data: true },
  })

  // 3. 掃描殘留 key
  const orphanKeyItems: OrphanKeyItem[] = []
  const rowUpdatesMap = new Map<number, { tableId: number; rowId: number; before: any; after: any; removedKeys: string[] }>()

  for (const r of rows) {
    const data = typeof r.data === 'string' ? safeJsonParse<Record<string, any>>(r.data, {}) : ((r.data as Record<string, any>) || {})
    const tableDeletedFields = deletedFieldsByTable.get(r.tableId) || []

    const nextData = { ...data }
    let rowModified = false
    const removedKeys: string[] = []

    for (const df of tableDeletedFields) {
      const fieldKey = `field_${df.id}`
      if (fieldKey in data && data[fieldKey] !== undefined) {
        rowModified = true
        removedKeys.push(fieldKey)
        delete nextData[fieldKey]

        orphanKeyItems.push({
          tableId: r.tableId,
          rowId: r.id,
          deletedFieldId: df.id,
          fieldKey,
          fieldName: df.name,
          originalData: data,
          cleanedData: nextData,
        })
      }
    }

    if (rowModified) {
      rowUpdatesMap.set(r.id, {
        tableId: r.tableId,
        rowId: r.id,
        before: data,
        after: nextData,
        removedKeys,
      })
    }
  }

  console.log('掃描統計：')
  console.log(`- 發現已刪除欄位數量: ${deletedFields.length} 個 (分布在 ${affectedTableIds.length} 張表)`)
  console.log(`- 發現殘留已刪除欄位 key 總數: ${orphanKeyItems.length} 筆 (涵蓋 ${rowUpdatesMap.size} 列 TableRow)\n`)

  if (orphanKeyItems.length === 0) {
    console.log('🎉 目前沒有任何 TableRow 殘留已刪除欄位的 key！')
    return
  }

  // 4. 印出清單明細 (前 20 筆)
  console.log('--- 殘留 Key 詳細清單 (前 20 筆) ---')
  orphanKeyItems.slice(0, 20).forEach((item, idx) => {
    console.log(
      `[#${idx + 1}] tableId: ${item.tableId}, rowId: ${item.rowId}, 已刪欄位: ${item.fieldName} (${item.fieldKey})`
    )
  })
  if (orphanKeyItems.length > 20) {
    console.log(`... 還有其餘 ${orphanKeyItems.length - 20} 筆`)
  }
  console.log('------------------------------------\n')

  if (isDryRun) {
    console.log('💡 [DRY RUN 結束] 資料庫未作任何變更。')
    console.log('如需真正執行清理，請執行: npx tsx scripts/fixOrphanFieldKeys.ts --execute')
    return
  }

  // 5. 確認執行
  const confirmed =
    autoConfirm ||
    (await promptConfirmation(
      `⚠️  請確認是否要清理這 ${rowUpdatesMap.size} 列 TableRow 中的 ${orphanKeyItems.length} 個殘留 key？請輸入 "yes" 確認: `
    ))

  if (!confirmed) {
    console.log('已取消執行。')
    return
  }

  // 6. 記錄 Rollback Log
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFilePath = path.join(logDir, `fixOrphanFieldKeys-${timestamp}.json`)

  const updatesList = Array.from(rowUpdatesMap.values())

  fs.writeFileSync(
    logFilePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalResidualKeysCleaned: orphanKeyItems.length,
        affectedRowsCount: updatesList.length,
        changes: updatesList,
      },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`\n📝 已儲存備份與清理記錄檔: ${logFilePath}`)

  // 7. 分批 Transaction 寫入 (每批 50 筆)
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

  console.log(`\n🎉 殘留 Key 清理完成！共清理 ${orphanKeyItems.length} 個失效 key。`)
}

main()
  .catch((err) => {
    console.error('[fixOrphanFieldKeys Error]:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
