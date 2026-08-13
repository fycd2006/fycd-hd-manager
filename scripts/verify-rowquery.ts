/**
 * Verification script: compares fast-path (DB pushdown) results against
 * legacy in-memory expectations on real dev data.
 * Run via esbuild bundle + node (see verify command in chat history).
 */
import { getPopulatedTableRows } from '../src/modules/database/services/rowQuery'
import prisma from '../src/lib/prisma'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) {
    failures++
    console.log(`❌ ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)
  } else {
    console.log(`✅ ${name}: ${JSON.stringify(actual)}`)
  }
}

async function main() {
  const table = await prisma.databaseTable.findFirst({
    where: { deletedAt: null },
    include: { _count: { select: { rows: true } } }
  })
  if (!table) {
    console.log('⚠️ 找不到任何資料表，跳過驗證')
    return
  }
  const tid = table.id
  console.log(`使用資料表 #${tid}「${table.name}」（${table._count.rows} 列）`)

  // 1. Unfiltered, unpaginated
  const all = await getPopulatedTableRows(tid, {}) as any
  const dbCount = await prisma.tableRow.count({ where: { tableId: tid, deletedAt: null } })
  check('無參數回傳全部列數', all.rows.length, dbCount)

  // 2. Pagination metadata
  const p1 = await getPopulatedTableRows(tid, { pageParam: '1', pageSizeParam: '5' }) as any
  check('分頁 totalRows', p1.data.pagination.totalRows, dbCount)
  check('分頁第一頁筆數', p1.data.rows.length, Math.min(5, dbCount))
  check('分頁 totalPages', p1.data.pagination.totalPages, Math.ceil(dbCount / 5))

  // 2b. Page 2 should not overlap page 1
  if (dbCount > 5) {
    const p2 = await getPopulatedTableRows(tid, { pageParam: '2', pageSizeParam: '5' }) as any
    const ids1 = new Set(p1.data.rows.map((r: any) => r.id))
    const overlap = p2.data.rows.filter((r: any) => ids1.has(r.id)).length
    check('第 1/2 頁無重疊', overlap, 0)
  }

  const fields = await prisma.tableField.findMany({
    where: { tableId: tid, deletedAt: null },
    orderBy: { order: 'asc' }
  })
  const storedField = fields.find(f => !['link_row', 'lookup', 'rollup', 'formula', 'collaborator', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by'].includes(f.type))

  if (storedField && all.rows.length > 0) {
    const fk = `field_${storedField.id}`
    const sampleRow = all.rows.find((r: any) => r.data[fk] !== undefined && r.data[fk] !== null && r.data[fk] !== '')
    if (sampleRow) {
      const sample = String(sampleRow.data[fk])
      // 3. equals filter: fast path vs legacy in-memory expectation
      const filtered = await getPopulatedTableRows(tid, { filterParam: `${fk}:equals:${sample}` }) as any
      const expectedIds = all.rows
        .filter((r: any) => String(r.data[fk] ?? '') === sample)
        .map((r: any) => r.id)
        .sort((a: number, b: number) => a - b)
      const actualIds = filtered.rows.map((r: any) => r.id).sort((a: number, b: number) => a - b)
      check(`equals 過濾 (${storedField.name}=${sample})`, actualIds, expectedIds)

      // 4. contains filter
      const needle = sample.slice(0, Math.min(2, sample.length))
      if (needle) {
        const contains = await getPopulatedTableRows(tid, { filterParam: `${fk}:contains:${needle}` }) as any
        const expectedContains = all.rows
          .filter((r: any) => String(r.data[fk] ?? '').toLowerCase().includes(needle.toLowerCase()))
          .map((r: any) => r.id)
          .sort((a: number, b: number) => a - b)
        const actualContains = contains.rows.map((r: any) => r.id).sort((a: number, b: number) => a - b)
        check(`contains 過濾 (${needle})`, actualContains, expectedContains)
      }
    }

    // 5. Sort consistency with legacy comparator
    const sorted = await getPopulatedTableRows(tid, { sortField: fk, sortOrder: 'asc' }) as any
    const legacySorted = [...all.rows].sort((a: any, b: any) => {
      const va = a.data[fk] ?? ''
      const vb = b.data[fk] ?? ''
      const numA = Number(va)
      const numB = Number(vb)
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      return String(va).localeCompare(String(vb))
    })
    const isNumeric = ['number', 'rating', 'percent', 'currency', 'autonumber'].includes(storedField.type)
    if (isNumeric) {
      check(`數字排序 (asc)`, sorted.rows.map((r: any) => r.id), legacySorted.map((r: any) => r.id))
    } else {
      console.log(`ℹ️ 字串排序略過逐項比對（DB collation 與 localeCompare 可能不同）`)
    }
  }

  // 6. pageSize=all
  const allExplicit = await getPopulatedTableRows(tid, { pageSizeParam: 'all' }) as any
  check('pageSize=all', allExplicit.rows.length, dbCount)

  // 7. Numeric comparison operators (REGEXP + CAST path)
  const numField = fields.find(f => f.type === 'number')
  if (numField && all.rows.length > 0) {
    const nk = `field_${numField.id}`
    const numericRows = all.rows.filter((r: any) => !isNaN(Number(String(r.data[nk] ?? ''))))
    if (numericRows.length > 0) {
      const values = numericRows.map((r: any) => Number(r.data[nk]))
      const mid = values.sort((a: number, b: number) => a - b)[Math.floor(values.length / 2)]

      const gt = await getPopulatedTableRows(tid, { filterParam: `${nk}:higher_than:${mid}` }) as any
      const expectedGt = numericRows.filter((r: any) => Number(r.data[nk]) > mid).map((r: any) => r.id).sort((a: number, b: number) => a - b)
      check(`higher_than ${mid}`, gt.rows.map((r: any) => r.id).sort((a: number, b: number) => a - b), expectedGt)

      const le = await getPopulatedTableRows(tid, { filterParam: `${nk}:lower_than_or_equal:${mid}` }) as any
      const expectedLe = numericRows.filter((r: any) => Number(r.data[nk]) <= mid).map((r: any) => r.id).sort((a: number, b: number) => a - b)
      check(`lower_than_or_equal ${mid}`, le.rows.map((r: any) => r.id).sort((a: number, b: number) => a - b), expectedLe)

      const sortedNum = await getPopulatedTableRows(tid, { sortField: nk, sortOrder: 'desc' }) as any
      const descVals = sortedNum.rows.map((r: any) => Number(r.data[nk] ?? 0))
      const isDesc = descVals.every((v: number, i: number) => i === 0 || descVals[i - 1] >= v)
      check('數字排序 (desc) 遞減', isDesc, true)
    }
  } else {
    console.log('ℹ️ 此表無 number 欄位，略過數值運算子測試')
  }

  await prisma.$disconnect()
  console.log(failures === 0 ? '\n全部驗證通過 🎉' : `\n有 ${failures} 項驗證失敗`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('驗證腳本執行失敗:', e)
  await prisma.$disconnect()
  process.exit(1)
})
