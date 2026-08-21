import prisma from '../src/lib/prisma'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 開始真實資料庫 (TiDB) NULL 值與髒資料安全防護 + 分頁驗證 ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 933333
  console.log(`使用 Table ID: ${table.id} (${table.name}), MasterView ID: ${testMasterViewId}`)

  // 清除前次殘留
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
  await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 50000 } } }).catch(() => {})

  const createdRowIds: number[] = []
  const createdOverrideIds: number[] = []

  try {
    // 建立 8 筆測試資料，涵蓋：正常數值、跨位數 Override、原始為 NULL、原始為髒字串 "N/A"、Override 為髒字串 "INVALID_STR"
    // R1: raw: 100           -> override: 5             -> effectiveNum: 5
    // R2: raw: 20            -> override: null          -> effectiveNum: 20
    // R3: raw: null (未填寫)  -> override: null          -> effectiveNum: null (純 NULL)
    // R4: raw: "N/A" (髒資料) -> override: null          -> effectiveNum: null (髒資料安全轉為 NULL)
    // R5: raw: 10            -> override: "INVALID_STR" -> effectiveNum: null (Override 髒資料安全轉為 NULL)
    // R6: raw: 50            -> override: 50            -> effectiveNum: 50
    // R7: raw: 300           -> override: null          -> effectiveNum: 300
    // R8: raw: 800           -> override: null          -> effectiveNum: 800
    const rawItems: { raw: any; override: any }[] = [
      { raw: 100, override: 5 },
      { raw: 20, override: null },
      { raw: null, override: null },
      { raw: 'N/A', override: null },
      { raw: 10, override: 'INVALID_STR' },
      { raw: 50, override: 50 },
      { raw: 300, override: null },
      { raw: 800, override: null },
    ]

    const testRows: any[] = []
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      const rowData = item.raw !== null ? { field_2: item.raw } : {}
      const row = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: 50000 + i,
          data: JSON.stringify(rowData),
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
      })
    }

    console.log('✓ 成功建立 8 筆包含 NULL 與髒資料的測試資料:')
    testRows.forEach((r, idx) => {
      console.log(`  Row[${idx + 1}] ID:${r.id} | raw:${JSON.stringify(r.raw)} | override:${JSON.stringify(r.override)}`)
    })

    const minTestId = testRows[0].id - 1
    const baseFilters: any[] = [{ field: 'id', operator: 'higher_than', value: String(minTestId) }]

    // ----------------------------------------------------------------
    // 步驟 1: 取得資料庫全量 Ground Truth (ASC 與 DESC)
    // ----------------------------------------------------------------
    console.log('\n[步驟 1] 查詢資料庫全量 Ground Truth 排序順序 (ASC 與 DESC)...')

    const fullAscRows = await prisma.$queryRaw<any[]>`
      SELECT r.id,
             CASE 
               WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_2"')), JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_2"')), '') REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
               THEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_2"')), JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_2"')), '') AS DECIMAL(30,10))
               ELSE NULL 
             END AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${testMasterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table.id} 
        AND r.deletedAt IS NULL 
        AND r.id > ${minTestId}
      ORDER BY (sort_val IS NULL) ASC, sort_val ASC, r.tableId ASC, r.id ASC
    `
    const expectedAscIds = fullAscRows.map((r) => r.id)
    console.log('  -> ASC Ground Truth IDs:', expectedAscIds, 'Values:', fullAscRows.map(r => r.sort_val))

    const fullDescRows = await prisma.$queryRaw<any[]>`
      SELECT r.id,
             CASE 
               WHEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_2"')), JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_2"')), '') REGEXP '^-?[0-9]+(\\.[0-9]+)?$'
               THEN CAST(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_2"')), JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_2"')), '') AS DECIMAL(30,10))
               ELSE NULL 
             END AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${testMasterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table.id} 
        AND r.deletedAt IS NULL 
        AND r.id > ${minTestId}
      ORDER BY (sort_val IS NULL) ASC, sort_val DESC, r.tableId DESC, r.id DESC
    `
    const expectedDescIds = fullDescRows.map((r) => r.id)
    console.log('  -> DESC Ground Truth IDs:', expectedDescIds, 'Values:', fullDescRows.map(r => r.sort_val))

    // ----------------------------------------------------------------
    // 步驟 2: 執行 ASC 分頁翻頁 (每頁 2 筆，連續翻 4 頁跨越數值與 NULL 邊界)
    // ----------------------------------------------------------------
    console.log('\n[步驟 2 / ASC 分頁] 執行 Keyset Cursor 分頁 (Page Size: 2, 預期翻 4 頁)...')

    const allAscPagedIds: number[] = []
    let ascCursor: string | null = null
    let pageNum = 0

    while (true) {
      pageNum++
      const res = await getMultiTableRows({
        tableIds: [table.id],
        masterViewId: testMasterViewId,
        sortField: 'field_2',
        sortOrder: 'asc',
        sortFieldType: 'number',
        filters: baseFilters,
        cursor: ascCursor,
        limit: 2,
      })

      if (res.rows.length === 0) break

      console.log(`  Page ${pageNum} 回傳 IDs:`, res.rows.map(r => r.id), 'values:', res.rows.map(r => (r as any).sort_val))
      allAscPagedIds.push(...res.rows.map(r => r.id))

      ascCursor = res.nextCursor
      if (!ascCursor) break
    }

    console.log('  -> ASC 分頁累積總 IDs:', allAscPagedIds)
    console.log('  -> ASC 預期 Ground Truth:', expectedAscIds)

    if (JSON.stringify(allAscPagedIds) !== JSON.stringify(expectedAscIds)) {
      throw new Error(`❌ ASC 翻頁結果不符！得到: ${JSON.stringify(allAscPagedIds)}，預期: ${JSON.stringify(expectedAscIds)}`)
    }
    console.log('  -> 判定: ✅ 通過 (ASC 跨數值與 NULL 邊界翻頁 100% 精準無遺漏！)')

    // ----------------------------------------------------------------
    // 步驟 3: 執行 DESC 分頁翻頁 (每頁 3 筆，連續翻 3 頁跨越數值與 NULL 邊界)
    // ----------------------------------------------------------------
    console.log('\n[步驟 3 / DESC 分頁] 執行 Keyset Cursor 分頁 (Page Size: 3, 預期翻 3 頁)...')

    const allDescPagedIds: number[] = []
    let descCursor: string | null = null
    let descPageNum = 0

    while (true) {
      descPageNum++
      const res = await getMultiTableRows({
        tableIds: [table.id],
        masterViewId: testMasterViewId,
        sortField: 'field_2',
        sortOrder: 'desc',
        sortFieldType: 'number',
        filters: baseFilters,
        cursor: descCursor,
        limit: 3,
      })

      if (res.rows.length === 0) break

      console.log(`  DESC Page ${descPageNum} 回傳 IDs:`, res.rows.map(r => r.id), 'values:', res.rows.map(r => (r as any).sort_val))
      allDescPagedIds.push(...res.rows.map(r => r.id))

      descCursor = res.nextCursor
      if (!descCursor) break
    }

    console.log('  -> DESC 分頁累積總 IDs:', allDescPagedIds)
    console.log('  -> DESC 預期 Ground Truth:', expectedDescIds)

    if (JSON.stringify(allDescPagedIds) !== JSON.stringify(expectedDescIds)) {
      throw new Error(`❌ DESC 翻頁結果不符！得到: ${JSON.stringify(allDescPagedIds)}，預期: ${JSON.stringify(expectedDescIds)}`)
    }
    console.log('  -> 判定: ✅ 通過 (DESC 跨數值與 NULL 邊界翻頁 100% 精準無遺漏！)')

    console.log('\n🎉🎉 NULL 值與髒資料安全防護 + Keyset Cursor 分頁真實 TiDB 驗證 100% PASS！')
  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
    await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 50000 } } }).catch(() => {})
    console.log('✓ 測試暫存資料已清除')
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
