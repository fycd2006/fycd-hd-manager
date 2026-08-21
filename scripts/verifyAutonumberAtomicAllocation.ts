import prisma from '../src/lib/prisma'
import { allocateAutonumbers } from '../src/modules/database/services/autonumberService'
import { createTableRow } from '../src/modules/database/services/createRow'

async function main() {
  console.log('=== 開始真實資料庫 (TiDB) Problem #8: Autonumber 原子分配與冷啟動驗證 ===\n')

  const db = await prisma.database.findFirst()
  if (!db) {
    console.error('❌ 找不到資料庫')
    return
  }

  // 1. 建立測試表與 autonumber 欄位
  const table = await prisma.databaseTable.create({
    data: { name: 'Test Autonumber Table', databaseId: db.id, autonumberCounter: 0 },
  })

  const autoField = await prisma.tableField.create({
    data: {
      tableId: table.id,
      name: 'AutoSeq',
      type: 'autonumber',
      order: 1,
    },
  })

  try {
    console.log('--- 測試一：冷啟動 SQL 聚合與初始化驗證 ---')
    // 預先插入兩筆模擬歷史資料（未更新計數器時 counter=0）
    await prisma.tableRow.create({
      data: { tableId: table.id, order: 1, data: { [`field_${autoField.id}`]: 15 } },
    })
    await prisma.tableRow.create({
      data: { tableId: table.id, order: 2, data: { [`field_${autoField.id}`]: 28 } },
    })

    // 呼叫 createTableRow 建立新列，驗證冷啟動是否自動將計數器初始化為 MAX(28) 並給出 29
    const createdRes = await createTableRow({
      tableId: table.id,
      input: {},
      username: 'TestUser',
    })

    const assignedVal = (createdRes as any).row?.data?.[`field_${autoField.id}`]
    console.log(`冷啟動新增列取得的 Autonumber: ${assignedVal} (預期 29)`)

    const refreshedTable = await prisma.databaseTable.findUnique({ where: { id: table.id } })
    console.log(`資料表目前 autonumberCounter: ${refreshedTable?.autonumberCounter} (預期 29)`)

    const test1Pass = assignedVal === 29 && refreshedTable?.autonumberCounter === 29
    console.log(`冷啟動測試結果: ${test1Pass ? '✅ PASS' : '❌ FAIL'}\n`)

    console.log('--- 測試二：高頻併發批次分配（無序號碰撞與空隙）---')
    // 5 個併發請求，每個請求申請 10 個序號（總計 50 個序號）
    const concurrentRequests = 5
    const batchSize = 10

    const results = await Promise.all(
      Array.from({ length: concurrentRequests }, () =>
        allocateAutonumbers(table.id, batchSize, [autoField.id])
      )
    )

    const allAllocated = results.flat()
    console.log(`併發分配總數: ${allAllocated.length} 個序號`)
    console.log(`序號區間: [${Math.min(...allAllocated)} ~ ${Math.max(...allAllocated)}]`)

    // 檢查是否有任何重複
    const uniqueSet = new Set(allAllocated)
    const hasDuplicates = uniqueSet.size !== allAllocated.length

    // 檢查是否連續無缺漏 (從 30 到 79)
    const sorted = [...allAllocated].sort((a, b) => a - b)
    let isContinuous = true
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== 30 + i) {
        isContinuous = false
        break
      }
    }

    console.log(`重複序號檢測: ${!hasDuplicates ? '✅ 0 碰撞 (PASS)' : '❌ 發生序號重複 (FAIL)'}`)
    console.log(`連續性檢測:   ${isContinuous ? '✅ 100% 連續無空隙 (PASS)' : '❌ 出現空隙或錯位 (FAIL)'}`)

    const test2Pass = !hasDuplicates && isContinuous && allAllocated.length === 50
    console.log(`併發分配測試結果: ${test2Pass ? '✅ PASS' : '❌ FAIL'}\n`)

    if (test1Pass && test2Pass) {
      console.log('🎉 Problem #8 Autonumber 原子分配器與 SQL 聚合驗證 100% 全部通過！')
    } else {
      process.exit(1)
    }
  } finally {
    // 清理測試資料
    await prisma.tableRow.deleteMany({ where: { tableId: table.id } })
    await prisma.tableField.deleteMany({ where: { tableId: table.id } })
    await prisma.databaseTable.deleteMany({ where: { id: table.id } })
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
