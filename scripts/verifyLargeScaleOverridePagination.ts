import prisma from '../src/lib/prisma'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 開始大規模資料量 (600 筆) 真實 TiDB 分頁與 Override 驗證 ===')

  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
  })

  if (!table) {
    console.error('❌ 找不到有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 977777
  const TOTAL_ROWS = 600
  const PAGE_SIZE = 50

  console.log(`使用 Table ID: ${table.id} (${table.name}), MasterView ID: ${testMasterViewId}`)
  console.log(`準備建立 ${TOTAL_ROWS} 筆測試資料 (包含大量 Override 與 TIE 打平排序值)...`)

  // 清除前次殘留
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
  await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 10000 } } }).catch(() => {})

  const createdRowIds: number[] = []
  const createdOverrideIds: number[] = []

  try {
    const rawItems: { raw: string; override: string | null }[] = []
    const categories = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry', 'Fig', 'Grape']

    for (let i = 0; i < TOTAL_ROWS; i++) {
      const cat = categories[i % categories.length]
      const rawVal = `${cat}_${String(i).padStart(4, '0')}`

      let overrideVal: string | null = null
      // 每 3 筆就有 1 筆 Override
      if (i % 3 === 0) {
        // 部分 Override 變大，部分 Override 變小，部分 Override 打平成同一個 TIE 值
        if (i % 6 === 0) {
          overrideVal = `TIE_GROUP_${String(i % 5)}` // 大量打平 TIE
        } else {
          overrideVal = `Override_${categories[(i + 3) % categories.length]}_${String(TOTAL_ROWS - i).padStart(4, '0')}`
        }
      }

      rawItems.push({ raw: rawVal, override: overrideVal })
    }

    // 批次寫入 TableRows
    console.log('正在寫入 600 筆 TableRow...')
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i]
      const row = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: 10000 + i,
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
    }

    console.log(`✓ 成功建立 ${createdRowIds.length} 筆 TableRow 與 ${createdOverrideIds.length} 筆 MasterViewOverride`)

    const minTestId = createdRowIds[0] - 1
    const baseFilters: any[] = [{ field: 'id', operator: 'higher_than', value: String(minTestId) }]

    // 1. 取得資料庫全量正確基準排序 (Ground Truth)
    console.log('\n[步驟 1] 查詢資料庫全量 Ground Truth 排序順序...')
    const fullDirectRows = await prisma.$queryRaw<any[]>`
      SELECT r.id,
             COALESCE(
               JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_1"')),
               JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_1"')),
               ''
             ) AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${testMasterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table.id} 
        AND r.deletedAt IS NULL 
        AND r.id > ${minTestId}
      ORDER BY sort_val ASC, r.tableId ASC, r.id ASC
    `
    const expectedIds = fullDirectRows.map((r) => r.id)
    console.log(`✓ 全量 Ground Truth 筆數: ${expectedIds.length} 筆`)

    // 2. 執行連續分頁翻頁
    console.log(`\n[步驟 2] 執行 Keyset Cursor 連續分頁 (Page Size: ${PAGE_SIZE}, 預期翻 ${TOTAL_ROWS / PAGE_SIZE} 頁)...`)

    const allPagedIds: number[] = []
    let currentCursor: string | null = null
    let pageCount = 0

    while (true) {
      pageCount++
      const res = await getMultiTableRows({
        tableIds: [table.id],
        masterViewId: testMasterViewId,
        sortField: 'field_1',
        sortOrder: 'asc',
        filters: baseFilters,
        cursor: currentCursor,
        limit: PAGE_SIZE,
      })

      if (res.rows.length === 0) break

      const pageIds = res.rows.map((r) => r.id)
      allPagedIds.push(...pageIds)

      currentCursor = res.nextCursor
      if (!currentCursor) break
    }

    console.log(`✓ 連續分頁完成: 共翻了 ${pageCount} 頁，累積取得 ${allPagedIds.length} 筆資料`)

    // 3. 完整性驗證
    console.log('\n[步驟 3] 執行嚴格資料比對與斷言...')
    const uniqueIds = new Set(allPagedIds)
    console.log(`- 總回傳筆數: ${allPagedIds.length} (預期: ${TOTAL_ROWS})`)
    console.log(`- 不重複 ID 數: ${uniqueIds.size} (預期: ${TOTAL_ROWS})`)

    if (allPagedIds.length !== TOTAL_ROWS) {
      throw new Error(`❌ 分頁資料總數不符合！預期 ${TOTAL_ROWS} 筆，實際取得 ${allPagedIds.length} 筆`)
    }
    if (uniqueIds.size !== TOTAL_ROWS) {
      throw new Error(`❌ 發現重複資料！有 ${TOTAL_ROWS - uniqueIds.size} 筆重複出現在不同分頁中`)
    }

    // 順序比對
    let isIdentical = true
    for (let i = 0; i < TOTAL_ROWS; i++) {
      if (allPagedIds[i] !== expectedIds[i]) {
        console.error(`❌ 索引 [${i}] 順序不符: 預期 ID ${expectedIds[i]}, 實際 ID ${allPagedIds[i]}`)
        isIdentical = false
        break
      }
    }

    if (!isIdentical) {
      throw new Error('❌ 分頁資料順序與 Ground Truth 不一致！')
    }

    console.log('✅ 大規模資料集 (600 筆) 翻頁結果 100% 正確：零重複、零遺漏、順序與 Ground Truth 完全吻合！')
  } finally {
    console.log('\n=== 清理測試暫存資料 ===')
    await prisma.masterViewOverride.deleteMany({ where: { masterViewId: testMasterViewId } }).catch(() => {})
    await prisma.tableRow.deleteMany({ where: { tableId: table.id, order: { gte: 10000 } } }).catch(() => {})
    console.log('✓ 測試暫存資料已完全清除')
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
