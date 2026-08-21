import fs from 'fs'
import path from 'path'
import readline from 'readline'
import prisma from '../src/lib/prisma'

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

  console.log(`\n=== DatabaseTable 子資料軟刪除同步工具 ===`)
  console.log(`模式: ${isDryRun ? '🔍 預覽模式 (DRY RUN - 不會修改資料庫)' : '⚡ 執行模式 (EXECUTE - 將寫入資料庫)'}\n`)

  // 1. 查詢所有已軟刪除的 DatabaseTable
  const deletedTables = await prisma.databaseTable.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true, name: true, deletedAt: true },
  })

  if (deletedTables.length === 0) {
    console.log('目前沒有任何已軟刪除的 DatabaseTable。')
    return
  }

  const deletedTableIds = deletedTables.map((t) => t.id)

  // 2. 查詢未同步 deletedAt 的 TableRow 與 TableField
  const unsoftDeletedRows = await prisma.tableRow.findMany({
    where: {
      tableId: { in: deletedTableIds },
      deletedAt: null,
    },
    select: { id: true, tableId: true },
  })

  const unsoftDeletedFields = await prisma.tableField.findMany({
    where: {
      tableId: { in: deletedTableIds },
      deletedAt: null,
    },
    select: { id: true, tableId: true, name: true },
  })

  console.log('掃描統計：')
  console.log(`- 已軟刪除的 DatabaseTable 數量: ${deletedTables.length} 張表 (tableIds: [${deletedTableIds.join(', ')}])`)
  console.log(`- 待同步軟刪除的 TableRow 數量: ${unsoftDeletedRows.length} 筆`)
  console.log(`- 待同步軟刪除的 TableField 數量: ${unsoftDeletedFields.length} 個\n`)

  deletedTables.forEach((t) => {
    const rows = unsoftDeletedRows.filter((r) => r.tableId === t.id)
    const fields = unsoftDeletedFields.filter((f) => f.tableId === t.id)
    if (rows.length > 0 || fields.length > 0) {
      console.log(`Table ID ${t.id} (${t.name || '未命名'}):`)
      console.log(`  - 待同步 TableRow: ${rows.length} 筆`)
      console.log(`  - 待同步 TableField: ${fields.length} 個 (${fields.map((f) => f.name).join(', ')})`)
      console.log(`  - 表格刪除時間戳: ${t.deletedAt?.toISOString()}`)
    }
  })
  console.log('')

  if (unsoftDeletedRows.length === 0 && unsoftDeletedFields.length === 0) {
    console.log('🎉 所有已刪除表格的子資料皆已同步軟刪除狀態，無須修復！')
    return
  }

  if (isDryRun) {
    console.log('💡 [DRY RUN 結束] 資料庫未作任何變更。')
    console.log('如需真正執行同步，請執行: npx tsx scripts/fixOrphanTableSoftDelete.ts --execute')
    return
  }

  // 3. 確認執行
  const confirmed =
    autoConfirm ||
    (await promptConfirmation(
      `⚠️  請確認是否要將這 ${unsoftDeletedRows.length} 筆 Row 與 ${unsoftDeletedFields.length} 個 Field 同步標記為軟刪除？請輸入 "yes" 確認: `
    ))

  if (!confirmed) {
    console.log('已取消執行。')
    return
  }

  // 4. 記錄 Rollback Log
  const logDir = path.join(process.cwd(), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const logFilePath = path.join(logDir, `fixOrphanTableSoftDelete-${timestamp}.json`)

  fs.writeFileSync(
    logFilePath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        tablesAffected: deletedTableIds,
        syncedRows: unsoftDeletedRows.map((r) => r.id),
        syncedFields: unsoftDeletedFields.map((f) => ({ id: f.id, name: f.name, tableId: f.tableId })),
      },
      null,
      2
    ),
    'utf-8'
  )
  console.log(`\n📝 已儲存備份紀錄檔: ${logFilePath}`)

  // 5. 批次執行更新
  for (const t of deletedTables) {
    const tableDeletedAt = t.deletedAt || new Date()
    await prisma.$transaction([
      prisma.tableRow.updateMany({
        where: { tableId: t.id, deletedAt: null },
        data: { deletedAt: tableDeletedAt },
      }),
      prisma.tableField.updateMany({
        where: { tableId: t.id, deletedAt: null },
        data: { deletedAt: tableDeletedAt },
      }),
    ])
  }

  console.log(`\n🎉 同步完成！已將 ${unsoftDeletedRows.length} 筆 Row 與 ${unsoftDeletedFields.length} 個 Field 標記軟刪除。`)
}

main()
  .catch((err) => {
    console.error('[fixOrphanTableSoftDelete Error]:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
