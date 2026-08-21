import prisma from '../src/lib/prisma'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 開始真實資料庫 (TiDB) 未補零真實數字型別欄位 Override 數值排序與分頁驗證 ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 944444
  console.log(`使用 Table ID: ${table.id} (${table.name}), MasterView ID: ${testMasterViewId}`)

  // 清除前次殘留
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
  await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 40000 } } }).catch(() => {})

  const createdRowIds: number[] = []
  const createdOverrideIds: number[] = []

  try {
    // 建立 6 筆真實未補零數字測試資料 (包含不同位數、跨位數 Override 與數值打平情境)
    // R1: raw 100 (三位數) -> override 5   (個位數) -> 數值期望 5
    // R2: raw 20  (兩位數) -> override null        -> 數值期望 20
    // R3: raw 50  (兩位數) -> override null        -> 數值期望 50
    // R4: raw 999 (三位數) -> override 50  (兩位數) -> 數值期望 50 (與 R3 數值打平 TIE)
    // R5: raw 10  (兩位數) -> override 300 (三位數) -> 數值期望 300
    // R6: raw 800 (三位數) -> override null        -> 數值期望 800
    const rawItems = [
      { raw: 100, override: 5 },
      { raw: 20, override: null },
      { raw: 50, override: null },
      { raw: 999, override: 50 },
      { raw: 10, override: 300 },
      { raw: 800, override: null },
    ]

    const testRows: any[] = []
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      const row = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: 40000 + i,
          data: JSON.stringify({ field_2: item.raw }),
        },
      })
      createdRowIds.push(row.id)

      if (item.override !== null) {
        const ov = await prisma.masterViewOverride.create({
          data: {
            masterViewId: testMasterViewId,
            sourceTableId: table.id,
            sourceRowId: row.id,
            overrides: JSON.stringify({ field_2: item.override }),
          },
        })
        createdOverrideIds.push(ov.id)
      }

      testRows.push({
        id: row.id,
        raw: item.raw,
        override: item.override,
        effectiveNum: item.override ?? item.raw,
      })
    }

    console.log('✓ 成功建立 6 筆未補零數字測試資料:')
    testRows.forEach((r, idx) => {
      console.log(`  Row[${idx + 1}] ID:${r.id} | raw:${r.raw} | override:${r.override ?? 'none'} -> effectiveNum:${r.effectiveNum}`)
    })

    const minTestId = testRows[0].id - 1
    const baseFilters: any[] = [{ field: 'id', operator: 'higher_than', value: String(minTestId) }]

    // 預期數值升序 ASC 順序: R1(5), R2(20), R3(50), R4(50), R5(300), R6(800)
    const expectedAscIds = [testRows[0].id, testRows[1].id, testRows[2].id, testRows[3].id, testRows[4].id, testRows[5].id]
    // 預期數值降序 DESC 順序: R6(800), R5(300), R4(50), R3(50), R2(20), R1(5)
    const expectedDescIds = [testRows[5].id, testRows[4].id, testRows[3].id, testRows[2].id, testRows[1].id, testRows[0].id]

    // ----------------------------------------------------------------
    // 驗證 1: 數值型別 ASC 升序分頁 (Page Size = 2，連續翻 3 頁)
    // ----------------------------------------------------------------
    console.log('\n[驗證 1 / 數字型別 ASC 升序分頁] 執行 ASC 分頁翻頁 (每頁 2 筆，翻 3 頁)...')

    const p1 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'asc',
      sortFieldType: 'number',
      filters: baseFilters,
      limit: 2,
    })
    console.log('  Page 1 結果 IDs:', p1.rows.map((r) => r.id), 'values:', p1.rows.map((r) => (r as any).sort_val))

    const p2 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'asc',
      sortFieldType: 'number',
      filters: baseFilters,
      cursor: p1.nextCursor,
      limit: 2,
    })
    console.log('  Page 2 結果 IDs:', p2.rows.map((r) => r.id), 'values:', p2.rows.map((r) => (r as any).sort_val))

    const p3 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'asc',
      sortFieldType: 'number',
      filters: baseFilters,
      cursor: p2.nextCursor,
      limit: 2,
    })
    console.log('  Page 3 結果 IDs:', p3.rows.map((r) => r.id), 'values:', p3.rows.map((r) => (r as any).sort_val))

    const allAscFetchedIds = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.id)
    console.log('  -> 3 頁合併總 IDs:', allAscFetchedIds)
    console.log('  -> 預期數值順序 IDs:', expectedAscIds)

    if (JSON.stringify(allAscFetchedIds) !== JSON.stringify(expectedAscIds)) {
      throw new Error(`❌ 數字欄位 ASC 翻頁不符合數值大小順序！得到: ${JSON.stringify(allAscFetchedIds)}，預期: ${JSON.stringify(expectedAscIds)}`)
    }
    console.log('  -> 判定: ✅ 通過 (ASC 嚴格依照數值大小 5 < 20 < 50 < 50 < 300 < 800 排序，非字典序！)')

    // ----------------------------------------------------------------
    // 驗證 2: 數值型別 DESC 降序分頁 (Page Size = 3，連續翻 2 頁)
    // ----------------------------------------------------------------
    console.log('\n[驗證 2 / 數字型別 DESC 降序分頁] 執行 DESC 分頁翻頁 (每頁 3 筆，翻 2 頁)...')

    const descP1 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'desc',
      sortFieldType: 'number',
      filters: baseFilters,
      limit: 3,
    })
    console.log('  DESC Page 1 結果 IDs:', descP1.rows.map((r) => r.id), 'values:', descP1.rows.map((r) => (r as any).sort_val))

    const descP2 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'desc',
      sortFieldType: 'number',
      filters: baseFilters,
      cursor: descP1.nextCursor,
      limit: 3,
    })
    console.log('  DESC Page 2 結果 IDs:', descP2.rows.map((r) => r.id), 'values:', descP2.rows.map((r) => (r as any).sort_val))

    const allDescFetchedIds = [...descP1.rows, ...descP2.rows].map((r) => r.id)
    console.log('  -> 2 頁合併總 IDs:', allDescFetchedIds)
    console.log('  -> 預期數值降序 IDs:', expectedDescIds)

    if (JSON.stringify(allDescFetchedIds) !== JSON.stringify(expectedDescIds)) {
      throw new Error(`❌ 數字欄位 DESC 翻頁不符合數值大小順序！得到: ${JSON.stringify(allDescFetchedIds)}，預期: ${JSON.stringify(expectedDescIds)}`)
    }
    console.log('  -> 判定: ✅ 通過 (DESC 嚴格依照數值大小 800 > 300 > 50 > 50 > 20 > 5 排序，無重複無遺漏！)')

    console.log('\n🎉🎉 未補零數字型別欄位 Override 數值排序與 Keyset Cursor 分頁真實 TiDB 驗證 100% PASS！')
  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
    await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 40000 } } }).catch(() => {})
    console.log('✓ 測試暫存資料已清除')
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
