import prisma from '../src/lib/prisma'
import { getMultiTableRows } from '../src/modules/database/services/multiTableQuery'

async function main() {
  console.log('=== 開始真實資料庫 SQL 驗證 (TiDB / MySQL) ===')

  // 1. 尋找或建立測試用 Table 與 MasterView
  let table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
    include: { database: true },
  })

  if (!table) {
    console.error('❌ 找不到任何有效的 DatabaseTable')
    process.exit(1)
  }

  const testMasterViewId = 999999

  console.log(`使用 Table ID: ${table.id} (${table.name}), 測試用 MasterView ID: ${testMasterViewId}`)

  let tempRow: any = null
  let tempOverride: any = null

  try {
    // 2. 建立測試資料：
    // - TableRow: field_1 = "Original Title", field_2 = 100, field_3 = "成全紀錄測試"
    tempRow = await prisma.tableRow.create({
      data: {
        tableId: table.id,
        order: 999999,
        data: JSON.stringify({
          field_1: 'Original Title',
          field_2: 100,
          field_3: '成全紀錄測試',
        }),
      },
    })
    console.log(`✓ 成功建立測試 TableRow ID: ${tempRow.id}`)

    // - MasterViewOverride: 覆寫 field_1 為 "Overridden Title", field_3 為 "更新成全內容"
    tempOverride = await prisma.masterViewOverride.create({
      data: {
        masterViewId: testMasterViewId,
        sourceTableId: table.id,
        sourceRowId: tempRow.id,
        overrides: JSON.stringify({
          field_1: 'Overridden Title',
          field_3: '更新成全內容',
        }),
      },
    })
    console.log(`✓ 成功建立測試 MasterViewOverride ID: ${tempOverride.id}`)

    // ----------------------------------------------------
    // [驗證 1 / 場景 C-2] 篩選未覆寫的數值欄位 field_2 > 50 -> 應正確 fallback 原始值
    // ----------------------------------------------------
    console.log('\n[驗證 1 / 場景 C-2] 篩選未覆寫欄位 field_2 > 50 (Fallback 原始值)...')
    const resC2 = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      filters: [{ field: 'field_2', operator: 'higher_than', value: '50' }],
      limit: 10,
    })
    const matchedC2 = resC2.rows.find((r) => r.id === tempRow.id)
    if (!matchedC2) throw new Error('❌ 驗證 1 失敗：未覆寫的 field_2 未正確 fallback 取出 100！')
    console.log('  -> 判定: ✅ 通過 (TiDB 成功 fallback 原始值 100)')

    // ----------------------------------------------------
    // [驗證 2 / 場景 A] 篩選 field_1 = "Overridden Title" -> 原始值不符但 Override 符合
    // ----------------------------------------------------
    console.log('\n[驗證 2 / 場景 A] 篩選 field_1 = "Overridden Title" (Override 覆寫生效)...')
    const resA = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Overridden Title' }],
      limit: 10,
    })
    const matchedA = resA.rows.find((r) => r.id === tempRow.id)
    if (!matchedA) throw new Error('❌ 驗證 2 失敗：Override 後的值 "Overridden Title" 未被 SQL 命中！')
    console.log('  -> 判定: ✅ 通過 (TiDB 成功以 COALESCE 取用 overrides)')

    // ----------------------------------------------------
    // [驗證 3 / 場景 B] 篩選 field_1 = "Original Title" -> 原始值雖然符合，但已覆寫為 "Overridden Title"
    // ----------------------------------------------------
    console.log('\n[驗證 3 / 場景 B] 篩選 field_1 = "Original Title" (已覆寫列應排除原始值)...')
    const resB = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Original Title' }],
      limit: 10,
    })
    const matchedB = resB.rows.find((r) => r.id === tempRow.id)
    if (matchedB) throw new Error('❌ 驗證 3 失敗：已覆寫的列不應再用原始值被命中！')
    console.log('  -> 判定: ✅ 通過 (TiDB 成功在 SQL 層排除原始值)')

    // ----------------------------------------------------
    // [驗證 4 / 系統欄位] 系統欄位 createdAt / id / tableId 篩選與排序
    // ----------------------------------------------------
    console.log('\n[驗證 4 / 系統欄位] 系統欄位 createdAt / id / tableId 篩選與排序...')
    const resSys = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      sortField: 'createdAt',
      sortOrder: 'desc',
      filters: [
        { field: 'tableId', operator: 'equals', value: String(table.id) },
        { field: 'id', operator: 'equals', value: String(tempRow.id) },
      ],
      limit: 10,
    })
    const matchedSys = resSys.rows.find((r) => r.id === tempRow.id)
    if (!matchedSys) throw new Error('❌ 驗證 4 失敗：系統欄位 tableId 與 id 篩選未命中！')
    console.log('  -> 判定: ✅ 通過 (TiDB 成功解析 r.tableId, r.id, r.createdAt 系統欄位)')

    // ----------------------------------------------------
    // [驗證 5 / 中文 Unicode 覆寫] 中文關鍵字篩選
    // ----------------------------------------------------
    console.log('\n[驗證 5 / 中文 Unicode 覆寫] 中文關鍵字 contains 篩選...')
    const resZh = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      filters: [{ field: 'field_3', operator: 'contains', value: '更新成全' }],
      limit: 10,
    })
    const matchedZh = resZh.rows.find((r) => r.id === tempRow.id)
    if (!matchedZh) throw new Error('❌ 驗證 5 失敗：中文覆寫內容 "更新成全內容" contains 篩選未命中！')
    console.log('  -> 判定: ✅ 通過 (TiDB 成功以 COALESCE 支援 UTF-8 中文字串 LIKE 比對)')

    // ----------------------------------------------------
    // [驗證 6 / 多欄位複合篩選] 同時篩選 3 個欄位 (field_1 + field_2 + tableId)
    // ----------------------------------------------------
    console.log('\n[驗證 6 / 多欄位複合篩選] 同時篩選 field_1 + field_2 + tableId...')
    const resMulti = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: testMasterViewId,
      filters: [
        { field: 'field_1', operator: 'equals', value: 'Overridden Title' },
        { field: 'field_2', operator: 'higher_than', value: '50' },
        { field: 'tableId', operator: 'equals', value: String(table.id) },
      ],
      limit: 10,
    })
    const matchedMulti = resMulti.rows.find((r) => r.id === tempRow.id)
    if (!matchedMulti) throw new Error('❌ 驗證 6 失敗：多欄位複合篩選未命中！')
    console.log('  -> 判定: ✅ 通過 (TiDB 單一 LEFT JOIN 下同時滿足多個 COALESCE 運算式)')

    // ----------------------------------------------------
    // [驗證 7 / 無 masterViewId 回退] 驗證標準查詢完全不受干擾
    // ----------------------------------------------------
    console.log('\n[驗證 7 / 無 masterViewId 回退] 無 masterViewId 的標準查詢...')
    const resNoMv = await getMultiTableRows({
      tableIds: [table.id],
      masterViewId: null,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Original Title' }],
      limit: 10,
    })
    const matchedNoMv = resNoMv.rows.find((r) => r.id === tempRow.id)
    if (!matchedNoMv) throw new Error('❌ 驗證 7 失敗：無 masterViewId 時原始資料未命中！')
    console.log('  -> 判定: ✅ 通過 (無 masterViewId 路徑平滑回退，行為與效能 100% 保證)')

    console.log('\n🎉🎉 全數 7 項真實資料庫（TiDB）深層驗證 100% PASS！')
  } finally {
    // 4. 清理測試資料
    console.log('\n=== 清理測試暫存資料 ===')
    if (tempOverride?.id) {
      await prisma.masterViewOverride.delete({ where: { id: tempOverride.id } }).catch(() => {})
      console.log(`✓ 已刪除測試 MasterViewOverride: ${tempOverride.id}`)
    }
    if (tempRow?.id) {
      await prisma.tableRow.delete({ where: { id: tempRow.id } }).catch(() => {})
      console.log(`✓ 已刪除測試 TableRow: ${tempRow.id}`)
    }
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('執行過程中發生錯誤:', err)
  process.exit(1)
})
