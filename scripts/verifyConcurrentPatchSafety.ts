import prisma from '../src/lib/prisma'
import { Prisma } from '@prisma/client'

// 模擬 PATCH 處理器核心的 JSON_SET 原子寫入邏輯
async function executeAtomicPatch(tableId: number, rowId: number, updateMap: Record<string, any>, delayMs: number) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const entries = Object.entries(updateMap).filter(([k]) => /^field_\d+$/.test(k))
  if (entries.length === 0) return

  const setFragments: Prisma.Sql[] = []
  for (const [k, val] of entries) {
    const jsonPath = `$.${k}`
    if (val === null || val === undefined) {
      setFragments.push(Prisma.sql`${jsonPath}, CAST('null' AS JSON)`)
    } else if (typeof val === 'number') {
      setFragments.push(Prisma.sql`${jsonPath}, ${val}`)
    } else if (typeof val === 'boolean') {
      setFragments.push(Prisma.sql`${jsonPath}, CAST(${val ? 'true' : 'false'} AS JSON)`)
    } else if (typeof val === 'object') {
      setFragments.push(Prisma.sql`${jsonPath}, CAST(${JSON.stringify(val)} AS JSON)`)
    } else {
      setFragments.push(Prisma.sql`${jsonPath}, ${String(val)}`)
    }
  }

  const now = new Date()
  await prisma.$executeRaw(
    Prisma.sql`UPDATE TableRow SET data = JSON_SET(COALESCE(data, '{}'), ${Prisma.join(setFragments, ', ')}), updatedAt = ${now} WHERE id = ${rowId} AND tableId = ${tableId} AND deletedAt IS NULL`
  )
}

async function main() {
  console.log('=== 開始真實資料庫 (TiDB) PATCH 併發寫入安全性驗證 (Lost Update 檢測) ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到有效的 DatabaseTable')
    process.exit(1)
  }

  const ITERATIONS = 50
  console.log(`使用 Table ID: ${table.id} (${table.name})，準備執行 ${ITERATIONS} 次併發衝突測試...`)

  let successCount = 0
  let failureCount = 0
  const failures: any[] = []
  const createdRowIds: number[] = []

  try {
    for (let i = 1; i <= ITERATIONS; i++) {
      // 每次測試建立全新獨立 TableRow (以 JSON 物件寫入)
      const initialRow = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: 60000 + i,
          data: { field_1: 'initial_1', field_2: 'initial_2' },
        },
      })
      createdRowIds.push(initialRow.id)

      const expectedVal1 = `concurrent_1_iter_${i}_${Date.now()}`
      const expectedVal2 = `concurrent_2_iter_${i}_${Date.now()}`

      // 產生 0-50ms 隨機抖動延遲，製造最大競態窗口
      const jitterA = Math.floor(Math.random() * 50)
      const jitterB = Math.floor(Math.random() * 50)

      // 同時發送兩個並發請求
      await Promise.all([
        executeAtomicPatch(table.id, initialRow.id, { field_1: expectedVal1 }, jitterA),
        executeAtomicPatch(table.id, initialRow.id, { field_2: expectedVal2 }, jitterB),
      ])

      // 讀回資料庫實際寫入結果
      const verifiedRow = await prisma.tableRow.findUnique({
        where: { id: initialRow.id },
      })

      const rawData = typeof verifiedRow?.data === 'string' ? JSON.parse(verifiedRow.data) : verifiedRow?.data || {}

      const field1Preserved = rawData.field_1 === expectedVal1
      const field2Preserved = rawData.field_2 === expectedVal2

      if (field1Preserved && field2Preserved) {
        successCount++
        if (i % 10 === 0 || i === ITERATIONS) {
          console.log(`  [進度] 執行完成 ${i}/${ITERATIONS} 次: 成功 ${successCount} 次, 失敗 ${failureCount} 次`)
        }
      } else {
        failureCount++
        console.error(`  ❌ 第 ${i} 次測試發生 Lost Update!`)
        console.error(`     預期: field_1="${expectedVal1}", field_2="${expectedVal2}"`)
        console.error(`     實際: field_1="${rawData.field_1}", field_2="${rawData.field_2}"`)
        failures.push({
          iteration: i,
          rowId: initialRow.id,
          expected: { field_1: expectedVal1, field_2: expectedVal2 },
          actual: rawData,
        })
      }
    }

    console.log('\n======================================================')
    console.log('=== 併發安全性整合測試 (Prompt 8 技術債) 統計報告 ===')
    console.log('======================================================')
    console.log(`總測試次數: ${ITERATIONS}`)
    console.log(`成功次數:   ${successCount}`)
    console.log(`失敗次數:   ${failureCount}`)
    console.log(`Lost Update 發生率: ${((failureCount / ITERATIONS) * 100).toFixed(2)}%`)

    if (failureCount === 0) {
      console.log('✅ 50 次高頻併發測試全部通過！MySQL / TiDB 原生 JSON_SET 原子操作完全無 Lost Update！')
    } else {
      console.error(`❌ 測試發現 ${failureCount} 次失敗，請參閱詳細日誌:`, failures)
      process.exit(1)
    }
  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    if (createdRowIds.length > 0) {
      await prisma.tableRow.deleteMany({
        where: { id: { in: createdRowIds } },
      }).catch(() => {})
      console.log(`✓ 已清除 ${createdRowIds.length} 筆測試 TableRow`)
    }
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
