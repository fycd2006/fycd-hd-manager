import prisma from '../src/lib/prisma'
import { Prisma } from '@prisma/client'

async function main() {
  const table = await prisma.databaseTable.findFirst({ where: { deletedAt: null } })
  if (!table) return

  const targetRowId = 5

  // 建立 4 筆測試資料:
  // R1: field_10 包含純數字陣列 [5, 12] -> TRUE 命中
  // R2: field_10 包含物件陣列 [{"id": 5, "value": "Task 5"}] -> TRUE 命中
  // R3: field_10 包含 [50, 15] (不含 5，但字串有 5) -> FALSE (LIKE 會誤判，JSON_CONTAINS/SEARCH 不應命中)
  // R4: field_99 (金額) 為 500，field_10 為 [1, 2] -> FALSE (LIKE 會誤判，JSON_CONTAINS/SEARCH 不應命中)
  const r1 = await prisma.tableRow.create({
    data: { tableId: table.id, order: 80001, data: { field_10: [5, 12] } },
  })
  const r2 = await prisma.tableRow.create({
    data: { tableId: table.id, order: 80002, data: { field_10: [{ id: 5, value: 'Task 5' }] } },
  })
  const r3 = await prisma.tableRow.create({
    data: { tableId: table.id, order: 80003, data: { field_10: [50, 15] } },
  })
  const r4 = await prisma.tableRow.create({
    data: { tableId: table.id, order: 80004, data: { field_99: 500, field_10: [1, 2] } },
  })

  const testIds = [r1.id, r2.id, r3.id, r4.id]

  console.log('=== 1. 舊版 LIKE 比對結果 ===')
  const likeMatches = await prisma.$queryRaw<any[]>`
    SELECT id, data FROM TableRow 
    WHERE id IN (${Prisma.join(testIds)}) 
      AND data LIKE ${'%' + String(targetRowId) + '%'}
  `
  console.log(`LIKE 撈出的筆數: ${likeMatches.length} 筆 (預期誤判 4 筆):`, likeMatches.map(r => r.id))

  console.log('\n=== 2. 精確 JSON 條件比對結果 ===')
  // 針對 field_10 執行精確比對：
  // 1. JSON_CONTAINS(data, '5', '$.field_10') (純數字陣列或數值)
  // 2. JSON_CONTAINS(data, '{"id": 5}', '$.field_10') (物件陣列)
  // 3. JSON_CONTAINS(JSON_EXTRACT(data, '$.field_10[*].id'), '5') (提煉 id 陣列比對)
  const jsonMatches = await prisma.$queryRaw<any[]>`
    SELECT id, data FROM TableRow
    WHERE id IN (${Prisma.join(testIds)})
      AND (
        JSON_CONTAINS(COALESCE(JSON_EXTRACT(data, '$.field_10'), '[]'), ${String(targetRowId)})
        OR JSON_CONTAINS(COALESCE(JSON_EXTRACT(data, '$.field_10[*].id'), '[]'), ${String(targetRowId)})
      )
  `
  console.log(`JSON_CONTAINS 撈出的筆數: ${jsonMatches.length} 筆 (預期精確 2 筆):`, jsonMatches.map(r => r.id))

  await prisma.tableRow.deleteMany({ where: { id: { in: testIds } } })
  await prisma.$disconnect()
}

main().catch(console.error)
