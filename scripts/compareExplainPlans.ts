import prisma from '../src/lib/prisma'

async function main() {
  const testMasterViewId = 988888
  const tableId = 5
  const minTestId = 1000000
  const cursorSortVal = 'Delta'
  const cursorRowId = 1000005

  console.log('=== 1. 修復前 (BEFORE: o.sourceRowId = r.id) ===')
  const explainBefore = await prisma.$queryRaw<any[]>`
    EXPLAIN
    SELECT * FROM (
      SELECT r.id, r.tableId, r.data, r.createdAt, r.updatedAt, 
             COALESCE(
               JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), '$."field_1"')),
               JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), '$."field_1"')),
               ''
             ) AS sort_val 
      FROM TableRow r 
      LEFT JOIN MasterViewOverride o 
        ON o.masterViewId = ${testMasterViewId} 
       AND o.sourceTableId = r.tableId 
       AND o.sourceRowId = r.id 
       AND o.deletedAt IS NULL 
      WHERE r.tableId = ${tableId} 
        AND r.deletedAt IS NULL 
        AND r.id > ${minTestId}
    ) AS master_union
    WHERE (sort_val > ${cursorSortVal}) 
       OR (sort_val = ${cursorSortVal} AND tableId > ${tableId}) 
       OR (sort_val = ${cursorSortVal} AND tableId = ${tableId} AND id > ${cursorRowId})
    ORDER BY sort_val ASC, tableId ASC, id ASC
    LIMIT 10
  `
  explainBefore.forEach((row) => {
    console.log(`${row.id.padEnd(35)} | ${row.task.padEnd(10)} | ${row['operator info']}`)
  })

  console.log('\n=== 2. 修復後 (AFTER: o.sourceRowId = (r.id + 0)) ===')
  const explainAfter = await prisma.$queryRaw<any[]>`
    EXPLAIN
    SELECT * FROM (
      SELECT r.id, r.tableId, r.data, r.createdAt, r.updatedAt, 
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
      WHERE r.tableId = ${tableId} 
        AND r.deletedAt IS NULL 
        AND r.id > ${minTestId}
    ) AS master_union
    WHERE (sort_val > ${cursorSortVal}) 
       OR (sort_val = ${cursorSortVal} AND tableId > ${tableId}) 
       OR (sort_val = ${cursorSortVal} AND tableId = ${tableId} AND id > ${cursorRowId})
    ORDER BY sort_val ASC, tableId ASC, id ASC
    LIMIT 10
  `
  explainAfter.forEach((row) => {
    console.log(`${row.id.padEnd(35)} | ${row.task.padEnd(10)} | ${row['operator info']}`)
  })

  await prisma.$disconnect()
}

main().catch(console.error)
