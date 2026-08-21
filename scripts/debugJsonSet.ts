import prisma from '../src/lib/prisma'
import { Prisma } from '@prisma/client'

async function main() {
  const table = await prisma.databaseTable.findFirst({ where: { deletedAt: null } })
  if (!table) return

  const row = await prisma.tableRow.create({
    data: {
      tableId: table.id,
      order: 99999,
      data: { field_1: 'init_1', field_2: 'init_2' },
    },
  })

  console.log('Initial row:', row)

  const jsonPath = '$.field_1'
  const val = 'updated_val_1'
  const now = new Date()

  const res = await prisma.$queryRaw<any[]>`
    SELECT 
      data, 
      JSON_SET(data, '$.field_1', 'updated_val_1') AS direct_set,
      JSON_SET(data, ${jsonPath}, ${val}) AS param_set
    FROM TableRow 
    WHERE id = ${row.id}
  `
  console.log('Query result:', res)

  await prisma.tableRow.delete({ where: { id: row.id } })
  await prisma.$disconnect()
}

main().catch(console.error)
