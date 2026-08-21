import prisma from '../src/lib/prisma'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 檢驗未補零真實數字在當前 getMultiTableRows 底下的排序行為 ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 955555
  console.log(`使用 Table ID: ${table.id} (${table.name}), MasterView ID: ${testMasterViewId}`)

  // 清除前次殘留
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
  await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 30000 } } }).catch(() => {})

  const createdRowIds: number[] = []
  const createdOverrideIds: number[] = []

  try {
    // 建立 6 筆真實未補零數字資料 (包含跨位數 Override)
    // R1: raw: 100 -> override: 5   -> 數值期望 5
    // R2: raw: 20  -> override: null-> 數值期望 20
    // R3: raw: 50  -> override: null-> 數值期望 50
    // R4: raw: 999 -> override: 50  -> 數值期望 50 (打平)
    // R5: raw: 10  -> override: 300 -> 數值期望 300
    // R6: raw: 800 -> override: null-> 數值期望 800
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
          order: 30000 + i,
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

    console.log('✓ 成功建立 6 筆真實數字測試資料:')
    testRows.forEach((r, idx) => {
      console.log(`  Row[${idx + 1}] ID:${r.id} | raw:${r.raw} | override:${r.override ?? 'none'} -> effectiveNum:${r.effectiveNum}`)
    })

    const minTestId = testRows[0].id - 1
    const baseFilters: any[] = [{ field: 'id', operator: 'higher_than', value: String(minTestId) }]

    console.log('\n[測試] 執行當前 getMultiTableRows 查詢 (sortField: field_2, ASC)...')
    const res = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'field_2',
      sortOrder: 'asc',
      filters: baseFilters,
      limit: 10,
    })

    console.log('實際回傳順序:')
    res.rows.forEach((r, idx) => {
      console.log(`  [${idx + 1}] ID: ${r.id}, sort_val: "${(r as any).sort_val}", data:`, r.data)
    })

    // 檢查是否發生字串排序順序 (例如 20, 300, 5, 50, 800)
    const returnedVals = res.rows.map((r) => String((r as any).sort_val))
    console.log('回傳的 sort_val 陣列:', returnedVals)

  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
    await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 30000 } } }).catch(() => {})
    await prisma.$disconnect()
  }
}

main().catch(console.error)
