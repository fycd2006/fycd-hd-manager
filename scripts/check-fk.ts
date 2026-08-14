import prisma from '../src/lib/prisma'

async function main() {
  try {
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE 
      FROM information_schema.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE()
    `)
    console.log("Constraints:", constraints)

    const fks = await prisma.$queryRawUnsafe(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    `)
    console.log("Foreign Keys:", fks)
  } catch (e) {
    console.error("Error:", e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
