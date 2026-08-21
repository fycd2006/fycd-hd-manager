import prisma from '../src/lib/prisma'
import { cascadeRecomputeSingleLevel } from '../src/modules/database/services/rowCascade'

async function main() {
  console.log('=== 開始真實資料庫 (TiDB) rowCascade JSON_CONTAINS 候選列精確篩選驗證 ===')

  const db = await prisma.database.findFirst()
  if (!db) {
    console.error('❌ 找不到資料庫')
    return
  }

  const tableA = await prisma.databaseTable.create({
    data: { name: 'Test Cascade Table A', databaseId: db.id },
  })
  const tableB = await prisma.databaseTable.create({
    data: { name: 'Test Cascade Table B', databaseId: db.id },
  })

  // 2. 在 Table B 建立 link_row, number, formula 欄位
  const linkField = await prisma.tableField.create({
    data: {
      tableId: tableB.id,
      name: 'LinkToA',
      type: 'link_row',
      options: JSON.stringify({ targetTableId: tableA.id }),
      order: 1,
    },
  })

  const numField = await prisma.tableField.create({
    data: {
      tableId: tableB.id,
      name: 'Amount',
      type: 'number',
      order: 2,
    },
  })

  const formulaField = await prisma.tableField.create({
    data: {
      tableId: tableB.id,
      name: 'DoubleAmount',
      type: 'formula',
      options: JSON.stringify({ expression: `field_${numField.id} * 2` }),
      order: 3,
    },
  })

  const targetRowId = 5

  // 3. 在 Table B 插入 4 種典型測試列
  // B1: 正確關聯純數字陣列 [5]
  const b1 = await prisma.tableRow.create({
    data: {
      tableId: tableB.id,
      order: 1,
      data: {
        [`field_${linkField.id}`]: [targetRowId],
        [`field_${numField.id}`]: 25,
        [`field_${formulaField.id}`]: '0',
      },
    },
  })

  // B2: 正確關聯物件陣列 [{ id: 5, value: 'Old Label' }]
  const b2 = await prisma.tableRow.create({
    data: {
      tableId: tableB.id,
      order: 2,
      data: {
        [`field_${linkField.id}`]: [{ id: targetRowId, value: 'Old Label' }],
        [`field_${numField.id}`]: 40,
        [`field_${formulaField.id}`]: '0',
      },
    },
  })

  // B3: 假候選列 A (包含數字 50, 15，舊 LIKE '%5%' 會誤判)
  const b3 = await prisma.tableRow.create({
    data: {
      tableId: tableB.id,
      order: 3,
      data: {
        [`field_${linkField.id}`]: [50, 15],
        [`field_${numField.id}`]: 100,
        [`field_${formulaField.id}`]: '0',
      },
    },
  })

  // B4: 假候選列 B (數值欄位有 500，舊 LIKE '%5%' 會誤判)
  const b4 = await prisma.tableRow.create({
    data: {
      tableId: tableB.id,
      order: 4,
      data: {
        [`field_${linkField.id}`]: [1, 2],
        [`field_${numField.id}`]: 500,
        [`field_${formulaField.id}`]: '0',
      },
    },
  })

  console.log('測試資料建立完成：')
  console.log(`- B1 (真正關聯 [5]): Row ID = ${b1.id}`)
  console.log(`- B2 (真正關聯 [{id: 5}]): Row ID = ${b2.id}`)
  console.log(`- B3 (假候選 [50, 15]): Row ID = ${b3.id}`)
  console.log(`- B4 (假候選 金額 500): Row ID = ${b4.id}`)

  // 4. 執行級聯重算
  console.log(`\n觸發 Table A 的 Row ${targetRowId} 更新，執行 cascadeRecomputeSingleLevel...`)
  const affected = await cascadeRecomputeSingleLevel(tableA.id, targetRowId)

  console.log(`\n級聯計算回傳的受影響列數量: ${affected.length} 筆 (預期精確為 2 筆)`)
  affected.forEach((row) => {
    console.log(`  -> 受影響 Row ID ${row.id}: DoubleAmount = ${row.data[`field_${formulaField.id}`]}`)
  })

  // 5. 驗證資料庫實際持久化數值
  const [dbB1, dbB2, dbB3, dbB4] = await Promise.all([
    prisma.tableRow.findUnique({ where: { id: b1.id } }),
    prisma.tableRow.findUnique({ where: { id: b2.id } }),
    prisma.tableRow.findUnique({ where: { id: b3.id } }),
    prisma.tableRow.findUnique({ where: { id: b4.id } }),
  ])

  const parseData = (r: any) => (typeof r?.data === 'string' ? JSON.parse(r.data) : r?.data || {})
  const b1Data = parseData(dbB1)
  const b2Data = parseData(dbB2)
  const b3Data = parseData(dbB3)
  const b4Data = parseData(dbB4)

  const b1Correct = b1Data[`field_${formulaField.id}`] === '50'
  const b2Correct = b2Data[`field_${formulaField.id}`] === '80'
  const b3Untouched = b3Data[`field_${formulaField.id}`] === '0'
  const b4Untouched = b4Data[`field_${formulaField.id}`] === '0'

  console.log('\n=== 真實資料庫資料驗證結果 ===')
  console.log(`B1 (預期公式重算 25*2 = 50): ${b1Data[`field_${formulaField.id}`]} -> ${b1Correct ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`B2 (預期公式重算 40*2 = 80): ${b2Data[`field_${formulaField.id}`]} -> ${b2Correct ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`B3 (預期未被誤算，維持 0):   ${b3Data[`field_${formulaField.id}`]} -> ${b3Untouched ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`B4 (預期未被誤算，維持 0):   ${b4Data[`field_${formulaField.id}`]} -> ${b4Untouched ? '✅ PASS' : '❌ FAIL'}`)

  // 6. 清理測試資料
  await prisma.tableRow.deleteMany({ where: { id: { in: [b1.id, b2.id, b3.id, b4.id] } } })
  await prisma.tableField.deleteMany({ where: { id: { in: [linkField.id, numField.id, formulaField.id] } } })
  await prisma.databaseTable.deleteMany({ where: { id: { in: [tableA.id, tableB.id] } } })
  await prisma.$disconnect()

  if (b1Correct && b2Correct && b3Untouched && b4Untouched && affected.length === 2) {
    console.log('\n🎉 真實 TiDB rowCascade JSON_CONTAINS 候選列精準篩選驗證 100% 通過！')
  } else {
    console.error('\n❌ 驗證失敗，請檢查上述輸出')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
