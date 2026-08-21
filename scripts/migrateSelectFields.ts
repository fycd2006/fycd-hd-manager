import prisma from '../src/lib/prisma'
import { migrateSelectFieldsForTable } from '../src/modules/database/services/selectFieldMigration'

async function main() {
  const args = process.argv.slice(2)
  let tableId: number | undefined
  let fieldId: number | undefined

  for (const arg of args) {
    if (arg.startsWith('--tableId=')) {
      const parsed = parseInt(arg.split('=')[1], 10)
      if (!isNaN(parsed)) tableId = parsed
    }
    if (arg.startsWith('--fieldId=')) {
      const parsed = parseInt(arg.split('=')[1], 10)
      if (!isNaN(parsed)) fieldId = parsed
    }
  }

  console.log(`[Select Field Migration] 開始執行... (tableId: ${tableId ?? '全表'}, fieldId: ${fieldId ?? '全部'})`)

  const result = await migrateSelectFieldsForTable(tableId, fieldId)

  console.log(`[Select Field Migration] 完成! 更新了 ${result.fieldsMigrated} 個欄位設定, ${result.rowsMigrated} 列資料。`)
}

main()
  .catch((err) => {
    console.error('[Select Field Migration Error]:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
