import prisma from '../src/lib/prisma'

async function main() {
  try {
    const res = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE WorkspaceUser`)
    console.log("SHOW CREATE TABLE WorkspaceUser:\n", res)
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
