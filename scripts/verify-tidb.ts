import prisma from '../src/lib/prisma'

async function checkTidb() {
  try {
    const res = await prisma.$queryRaw`SELECT version();`
    console.log("Database Version:", res)
    
    // Also check auto_id_cache variable to see if it's set
    try {
        const vars = await prisma.$queryRaw`SHOW VARIABLES LIKE 'auto_id_cache'`
        console.log("AUTO_ID_CACHE:", vars)
    } catch(e) {
        console.log("Could not query auto_id_cache")
    }

    // Check sql_mode
    const sqlMode = await prisma.$queryRaw`SELECT @@sql_mode;`
    console.log("SQL_MODE:", sqlMode)
  } catch(e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
}

checkTidb()
