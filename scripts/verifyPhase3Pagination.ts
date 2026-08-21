import prisma from '../src/lib/prisma'
import { getMultiTableRows, parseCursor } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 開始階段三真實資料庫驗證 (TiDB / MySQL: 排序與 Keyset Cursor 分頁) ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到任何有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 988888
  console.log(`使用 Table ID: ${table.id} (${table.name}), 測試 MasterView ID: ${testMasterViewId}`)

  // 清除前次可能殘留的測試 TableRow 與 Override
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
  await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 1000 } } }).catch(() => {})

  const createdRowIds: number[] = []
  const createdOverrideIds: number[] = []

  try {
    // 1. 建立 6 筆測試資料，設計 Override 造成值改變以及打平 (TIE) 的情況
    // R1: raw "Alpha" -> effective "Alpha"
    // R2: raw "Gamma" -> override "Beta" -> effective "Beta"
    // R3: raw "Delta" -> effective "Delta"
    // R4: raw "Zeta"  -> override "Delta" -> effective "Delta" (與 R3 打平 TIE)
    // R5: raw "Omega" -> effective "Omega"
    // R6: raw "Alpha" -> override "Zeta"  -> effective "Zeta"
    const rawItems = [
      { raw: 'Alpha', override: null },
      { raw: 'Gamma', override: 'Beta' },
      { raw: 'Delta', override: null },
      { raw: 'Zeta', override: 'Delta' },
      { raw: 'Omega', override: null },
      { raw: 'Alpha', override: 'Zeta' },
    ]

    const testRows: any[] = []
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      const row = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: 1000 + i,
          data: JSON.stringify({ field_1: item.raw }),
        },
      })
      createdRowIds.push(row.id)

      if (item.override) {
        const ov = await prisma.masterViewOverride.create({
          data: {
            masterViewId: testMasterViewId,
            sourceTableId: table.id,
            sourceRowId: row.id,
            overrides: JSON.stringify({ field_1: item.override }),
          },
        })
        createdOverrideIds.push(ov.id)
      }

      testRows.push({
        id: row.id,
        raw: item.raw,
        override: item.override,
        effective: item.override || item.raw,
      })
    }

    console.log('✓ 成功建立 6 筆測試資料與對應 Override:')
    testRows.forEach((r, idx) => {
      console.log(`  Row[${idx + 1}] ID:${r.id} | raw:"${r.raw}" | override:${r.override ? `"${r.override}"` : 'none'} -> effective:"${r.effective}"`)
    })

    // 預期升序 ASC 順序: R1("Alpha"), R2("Beta"), R3("Delta"), R4("Delta"), R5("Omega"), R6("Zeta")
    const expectedAscIds = [testRows[0].id, testRows[1].id, testRows[2].id, testRows[3].id, testRows[4].id, testRows[5].id]
    // 預期降序 DESC 順序: R6("Zeta"), R5("Omega"), R4("Delta"), R3("Delta"), R2("Beta"), R1("Alpha")
    const expectedDescIds = [testRows[5].id, testRows[4].id, testRows[3].id, testRows[2].id, testRows[1].id, testRows[0].id]

    const minTestId = testRows[0].id - 1
    const baseFilters: any[] = [{ field: 'id', operator: 'higher_than', value: String(minTestId) }]

    // ----------------------------------------------------------------
    // 驗證 1: 升序 ASC 分頁 (Page Size = 2，模擬連續翻 3 頁)
    // ----------------------------------------------------------------
    console.log('\n[驗證 1 / ASC 分頁] 執行 ASC 分頁翻頁 (每頁 2 筆，翻 3 頁)...')

    // Page 1
    const p1 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_1',
      sortOrder: 'asc',
      filters: baseFilters,
      limit: 2,
    })
    console.log('  Page 1 結果 IDs:', p1.rows.map((r) => r.id), 'values:', p1.rows.map((r) => (r as any).sort_val))
    if (p1.rows.length !== 2 || p1.rows[0].id !== expectedAscIds[0] || p1.rows[1].id !== expectedAscIds[1]) {
      throw new Error(`❌ ASC Page 1 不符合預期！預期 [${expectedAscIds.slice(0, 2)}] 得到 [${p1.rows.map((r) => r.id)}]`)
    }

    // Page 2 (跨越 TIE "Delta" 邊界)
    const p2 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_1',
      sortOrder: 'asc',
      filters: baseFilters,
      cursor: p1.nextCursor,
      limit: 2,
    })
    console.log('  Page 2 結果 IDs:', p2.rows.map((r) => r.id), 'values:', p2.rows.map((r) => (r as any).sort_val))
    if (p2.rows.length !== 2 || p2.rows[0].id !== expectedAscIds[2] || p2.rows[1].id !== expectedAscIds[3]) {
      throw new Error(`❌ ASC Page 2 (TIE 邊界) 不符合預期！預期 [${expectedAscIds.slice(2, 4)}] 得到 [${p2.rows.map((r) => r.id)}]`)
    }

    // Page 3
    const p3 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_1',
      sortOrder: 'asc',
      filters: baseFilters,
      cursor: p2.nextCursor,
      limit: 2,
    })
    console.log('  Page 3 結果 IDs:', p3.rows.map((r) => r.id), 'values:', p3.rows.map((r) => (r as any).sort_val))
    if (p3.rows.length !== 2 || p3.rows[0].id !== expectedAscIds[4] || p3.rows[1].id !== expectedAscIds[5]) {
      throw new Error(`❌ ASC Page 3 不符合預期！預期 [${expectedAscIds.slice(4, 6)}] 得到 [${p3.rows.map((r) => r.id)}]`)
    }

    const allAscFetchedIds = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.id)
    console.log('  -> 3 頁合併總 IDs:', allAscFetchedIds)
    console.log('  -> 預期總順序 IDs:', expectedAscIds)
    if (JSON.stringify(allAscFetchedIds) !== JSON.stringify(expectedAscIds)) {
      throw new Error('❌ ASC 翻頁資料順序不一致或有重複/遺漏！')
    }
    console.log('  -> 判定: ✅ 通過 (ASC 翻頁無任何重複、無任何遺漏，TIE 打平時次要鍵正確介入)')

    // ----------------------------------------------------------------
    // 驗證 2: 降序 DESC 分頁 (Page Size = 3，模擬連續翻 2 頁)
    // ----------------------------------------------------------------
    console.log('\n[驗證 2 / DESC 分頁] 執行 DESC 分頁翻頁 (每頁 3 筆，翻 2 頁)...')

    const descP1 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_1',
      sortOrder: 'desc',
      filters: baseFilters,
      limit: 3,
    })
    console.log('  DESC Page 1 結果 IDs:', descP1.rows.map((r) => r.id), 'values:', descP1.rows.map((r) => (r as any).sort_val))

    const descP2 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_1',
      sortOrder: 'desc',
      filters: baseFilters,
      cursor: descP1.nextCursor,
      limit: 3,
    })
    console.log('  DESC Page 2 結果 IDs:', descP2.rows.map((r) => r.id), 'values:', descP2.rows.map((r) => (r as any).sort_val))

    const allDescFetchedIds = [...descP1.rows, ...descP2.rows].map((r) => r.id)
    console.log('  -> 2 頁合併總 IDs:', allDescFetchedIds)
    console.log('  -> 預期總順序 IDs:', expectedDescIds)
    if (JSON.stringify(allDescFetchedIds) !== JSON.stringify(expectedDescIds)) {
      throw new Error('❌ DESC 翻頁資料順序不一致或有重複/遺漏！')
    }
    console.log('  -> 判定: ✅ 通過 (DESC 翻頁無任何重複、無任何遺漏，Keyset Cursor 降序定位精準)')

    console.log('\n🎉🎉 階段三真實資料庫（TiDB）排序與 Keyset Cursor 翻頁驗證全數 PASS！')
  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    for (const ovId of createdOverrideIds) {
      await prisma.masterViewOverride.delete({ where: { id: ovId } }).catch(() => {})
    }
    for (const rowId of createdRowIds) {
      await prisma.tableRow.delete({ where: { id: rowId } }).catch(() => {})
    }
    console.log(`✓ 已刪除 ${createdOverrideIds.length} 筆 MasterViewOverride 與 ${createdRowIds.length} 筆 TableRow`)
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
