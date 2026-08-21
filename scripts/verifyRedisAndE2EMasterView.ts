import prisma from '../src/lib/prisma'
import { Prisma } from '@prisma/client'
import { GET } from '../src/app/api/workspaces/[id]/all-rows/route'
import { upsertMasterViewOverride } from '../src/modules/database/services/masterViewOverride'
import { getMasterViewCacheKey, getCachedMasterViewRows, invalidateMasterViewCacheForTable } from '../src/modules/database/services/masterViewCache'
import { buildEffectiveFieldSql, buildCrossTableFilterSql } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 階段四：端到端整合測試、Redis 快取一致性與 EXPLAIN ANALYZE 效能基準驗證 ===\n')

  // 1. 準備真實測試資料庫環境
  const db = await prisma.database.findFirst({
    include: { workspace: true },
  })

  if (!db || !db.workspace) {
    console.error('❌ 找不到有效的資料庫或工作區')
    return
  }

  const workspaceId = db.workspaceId

  // 建立 3 張測試表格
  const table1 = await prisma.databaseTable.create({ data: { name: 'E2E Table 1', databaseId: db.id } })
  const table2 = await prisma.databaseTable.create({ data: { name: 'E2E Table 2', databaseId: db.id } })
  const table3 = await prisma.databaseTable.create({ data: { name: 'E2E Table 3', databaseId: db.id } })

  // 各表建立一個數值欄位
  const field1 = await prisma.tableField.create({
    data: { tableId: table1.id, name: 'Score', type: 'number', order: 1 },
  })
  const field2 = await prisma.tableField.create({
    data: { tableId: table2.id, name: 'Score', type: 'number', order: 1 },
  })
  const field3 = await prisma.tableField.create({
    data: { tableId: table3.id, name: 'Score', type: 'number', order: 1 },
  })

  // 插入測試資料列
  const row1 = await prisma.tableRow.create({
    data: { tableId: table1.id, order: 1, data: { [`field_${field1.id}`]: 100 } },
  })
  const row2 = await prisma.tableRow.create({
    data: { tableId: table2.id, order: 2, data: { [`field_${field2.id}`]: 200 } },
  })
  const row3 = await prisma.tableRow.create({
    data: { tableId: table3.id, order: 3, data: { [`field_${field3.id}`]: 300 } },
  })

  const masterViewId = 99901

  // 建立 row1 的 Override (將 100 覆寫為 500)
  await upsertMasterViewOverride({
    masterViewId,
    sourceTableId: table1.id,
    sourceRowId: row1.id,
    overrides: { [`field_${field1.id}`]: 500 },
  })

  console.log('--- 項目一：端到端 (E2E) API 整合測試 ---')
  // 透過 Next.js API 路由 handler 模擬真實前端發出的完整 HTTP 請求
  const filters = [{ field: 'Score', operator: 'higher_than', value: '150' }]
  const url = `http://localhost:3000/api/workspaces/${workspaceId}/all-rows?masterViewId=${masterViewId}&tableIds=${table1.id},${table2.id},${table3.id}&sortField=field_${field1.id}&sortOrder=desc&filters=${encodeURIComponent(JSON.stringify(filters))}`
  
  const req = new Request(url)
  const res = await GET(req, { params: Promise.resolve({ id: String(workspaceId) }) })
  const json = await res.json()

  console.log(`HTTP 狀態碼: ${res.status}`)
  console.log(`回傳資料列數: ${json.rows?.length} 筆 (預期命中 3 筆: row1 override 500, row3 300, row2 200)`)
  
  const returnedRow1 = json.rows?.find((r: any) => r.id === row1.id && r.tableId === table1.id)
  console.log(`Row 1 數值 (預期為 Override 覆寫值 500): ${returnedRow1?.data?.[`field_${field1.id}`]}`)
  console.log(`Row 1 _hasOverride 標記: ${returnedRow1?._hasOverride}`)

  const e2ePass =
    res.status === 200 &&
    json.rows?.length === 3 &&
    returnedRow1?.data?.[`field_${field1.id}`] === 500 &&
    returnedRow1?._hasOverride === true

  console.log(`端到端 API 整合測試結果: ${e2ePass ? '✅ PASS' : '❌ FAIL'}\n`)

  console.log('--- 項目二：快取命中率與一致性驗證 (Cache Hit/Miss Cycle) ---')
  // 清理快取
  await invalidateMasterViewCacheForTable(table1.id)

  const cacheKey = getMasterViewCacheKey(workspaceId, masterViewId, {
    limit: 50,
    sortField: `field_${field1.id}`,
    sortOrder: 'desc',
    filters,
    tableIds: [table1.id, table2.id, table3.id],
  })

  // 1. 第一次查詢（預期 Cache MISS）
  const check1 = await getCachedMasterViewRows(cacheKey)
  console.log(`1. 初始狀態快取檢查: ${check1 === null ? '✅ MISS (如預期無快取)' : '❌ HIT'}`)

  // 執行 API 寫入快取
  await GET(new Request(url), { params: Promise.resolve({ id: String(workspaceId) }) })

  // 2. 第二次查詢（預期 Cache HIT）
  const check2 = await getCachedMasterViewRows(cacheKey)
  console.log(`2. 寫入後快取檢查: ${check2 !== null ? '✅ HIT (如預期命中快取)' : '❌ MISS'}`)

  // 3. 更新 Override (觸發 Invalidation)
  console.log('3. 更新 Override 數值 (500 -> 800)，觸發快取失效...')
  await upsertMasterViewOverride({
    masterViewId,
    sourceTableId: table1.id,
    sourceRowId: row1.id,
    overrides: { [`field_${field1.id}`]: 800 },
  })

  // 4. 失效後查詢（預期 Cache MISS）
  const check3 = await getCachedMasterViewRows(cacheKey)
  console.log(`4. 失效後快取檢查: ${check3 === null ? '✅ MISS (如預期成功失效)' : '❌ HIT (快取未失效，有污染風險!)'}`)

  // 5. 重新 API 查詢並驗證取得最新 800
  const res2 = await GET(new Request(url), { params: Promise.resolve({ id: String(workspaceId) }) })
  const json2 = await res2.json()
  const updatedRow1 = json2.rows?.find((r: any) => r.id === row1.id && r.tableId === table1.id)
  console.log(`5. 重新查詢取出的 Row 1 數值: ${updatedRow1?.data?.[`field_${field1.id}`]} (預期 800)`)

  const cachePass = check1 === null && check2 !== null && check3 === null && updatedRow1?.data?.[`field_${field1.id}`] === 800
  console.log(`快取一致性測試結果: ${cachePass ? '✅ PASS' : '❌ FAIL'}\n`)

  console.log('--- 項目三：典型 Master View EXPLAIN ANALYZE 效能基準採集 ---')
  // 組裝跨 3 表、含 Override LEFT JOIN、數值篩選、數值排序的典型查詢
  const explainSql = Prisma.sql`
    EXPLAIN ANALYZE
    SELECT * FROM (
      SELECT 
        r.id, 
        r.tableId, 
        r.data, 
        r.createdAt, 
        COALESCE(
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field1.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field1.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END,
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field1.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field1.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END
        ) AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${masterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table1.id} AND r.deletedAt IS NULL

      UNION ALL

      SELECT 
        r.id, 
        r.tableId, 
        r.data, 
        r.createdAt, 
        COALESCE(
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field2.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field2.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END,
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field2.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field2.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END
        ) AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${masterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table2.id} AND r.deletedAt IS NULL

      UNION ALL

      SELECT 
        r.id, 
        r.tableId, 
        r.data, 
        r.createdAt, 
        COALESCE(
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field3.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(o.overrides, '$."field_${Prisma.raw(String(field3.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END,
          CASE 
            WHEN JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field3.id))}"')) REGEXP '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(r.data, '$."field_${Prisma.raw(String(field3.id))}"')) AS DECIMAL(30,10)) 
            ELSE NULL 
          END
        ) AS sort_val
      FROM TableRow r
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${masterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = (r.id + 0) 
       AND o.deletedAt IS NULL
      WHERE r.tableId = ${table3.id} AND r.deletedAt IS NULL
    ) AS u
    ORDER BY sort_val DESC, tableId DESC, id DESC
    LIMIT 50
  `

  const plan = await prisma.$queryRawUnsafe<any[]>(explainSql.sql, ...explainSql.values)
  console.log('TiDB EXPLAIN ANALYZE 執行計畫輸出:')
  console.table(plan)

  // 6. 清理測試資料
  console.log('\n--- 清理測試資料 ---')
  await prisma.masterViewOverride.deleteMany({ where: { masterViewId } })
  await prisma.tableRow.deleteMany({ where: { id: { in: [row1.id, row2.id, row3.id] } } })
  await prisma.tableField.deleteMany({ where: { id: { in: [field1.id, field2.id, field3.id] } } })
  await prisma.databaseTable.deleteMany({ where: { id: { in: [table1.id, table2.id, table3.id] } } })
  await prisma.$disconnect()
  console.log('✓ 測試資料清理完成')
}

main().catch((err) => {
  console.error('執行失敗:', err)
  process.exit(1)
})
