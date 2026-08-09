import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const orphanedRows = await prisma.$queryRaw`
    SELECT r.id FROM TableRow r
    LEFT JOIN DatabaseTable t ON r.tableId = t.id
    WHERE t.id IS NULL;
  `
  console.log("Orphaned rows:", orphanedRows)

  const deleted = await prisma.$executeRaw`
    DELETE FROM TableRow WHERE tableId NOT IN (SELECT id FROM DatabaseTable);
  `
  console.log(`Deleted ${deleted} orphaned TableRow records.`)
  
  const deletedFields = await prisma.$executeRaw`
    DELETE FROM TableField WHERE tableId NOT IN (SELECT id FROM DatabaseTable);
  `
  console.log(`Deleted ${deletedFields} orphaned TableField records.`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
