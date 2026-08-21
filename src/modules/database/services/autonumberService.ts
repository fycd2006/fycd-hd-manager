import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * Atomically allocates a range of sequential autonumber values for a table.
 * 
 * 1. If cold-start initialization is needed (autonumberCounter is 0), uses a single SQL
 *    MAX aggregation query over JSON data rather than loading all table rows into memory.
 * 2. Uses atomic increment to allocate a contiguous block of numbers [startSeq, ..., endSeq].
 * 
 * @param tableId Target table ID
 * @param count Number of consecutive numbers to allocate (default 1)
 * @param autonumberFieldIds TableField IDs of type 'autonumber' (used for cold-start initialization)
 * @param txClient Optional Prisma transaction client
 * @returns Array of allocated numbers, e.g. count=3 starting at 5 -> [5, 6, 7]
 */
export async function allocateAutonumbers(
  tableId: number,
  count: number = 1,
  autonumberFieldIds: number[] = [],
  txClient?: Prisma.TransactionClient
): Promise<number[]> {
  if (count <= 0) return []
  const db = txClient || prisma

  // 1. Check if cold-start initialization is needed (autonumberCounter is 0)
  const currentTable = await db.databaseTable.findUnique({
    where: { id: tableId },
    select: { autonumberCounter: true },
  })

  if (currentTable && currentTable.autonumberCounter === 0 && autonumberFieldIds.length > 0) {
    // Single SQL aggregation over JSON instead of loading all rows into Node.js memory
    const maxClauses = autonumberFieldIds.map(
      (fid) => Prisma.sql`COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(data, ${`$."field_${fid}"`})) AS UNSIGNED)), 0)`
    )
    const selectClause =
      maxClauses.length === 1
        ? Prisma.sql`${maxClauses[0]} AS maxVal`
        : Prisma.sql`GREATEST(${Prisma.join(maxClauses, ', ')}) AS maxVal`

    const [aggResult] = await db.$queryRaw<{ maxVal: number | bigint }[]>(
      Prisma.sql`SELECT ${selectClause} FROM TableRow WHERE tableId = ${tableId} AND deletedAt IS NULL`
    )
    const maxVal = Number(aggResult?.maxVal || 0)
    if (maxVal > 0) {
      await db.databaseTable.update({
        where: { id: tableId },
        data: { autonumberCounter: maxVal },
      })
    }
  }

  // 2. Atomically increment the counter by count
  const updatedTable = await db.databaseTable.update({
    where: { id: tableId },
    data: { autonumberCounter: { increment: count } },
    select: { autonumberCounter: true },
  })

  const endSeq = updatedTable.autonumberCounter
  const startSeq = endSeq - count + 1

  const allocated: number[] = []
  for (let i = startSeq; i <= endSeq; i++) {
    allocated.push(i)
  }

  return allocated
}
