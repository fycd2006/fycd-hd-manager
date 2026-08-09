import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("Starting data validation for JSON migration...")
  
  // 1. Check TableRow data
  const rows = await prisma.tableRow.findMany({
    select: { id: true, data: true }
  })
  
  let invalidRows = 0
  for (const row of rows) {
    try {
      if (row.data === undefined || row.data === null || row.data === "") {
        throw new Error("Empty string")
      }
      JSON.parse(typeof row.data === 'string' ? row.data : JSON.stringify(row.data))
    } catch (e) {
      console.log(`Invalid JSON in TableRow ID ${row.id}:`, row.data)
      await prisma.tableRow.update({
        where: { id: row.id },
        data: { data: {} }
      })
      invalidRows++
    }
  }
  
  console.log(`Fixed ${invalidRows} invalid TableRow data entries.`)

  // 2. Check TableField options
  const fields = await prisma.tableField.findMany({
    select: { id: true, options: true }
  })

  let invalidFields = 0
  for (const field of fields) {
    if (field.options !== null && field.options !== "") {
      try {
        JSON.parse(typeof field.options === 'string' ? field.options : JSON.stringify(field.options))
      } catch (e) {
        console.log(`Invalid JSON in TableField ID ${field.id}:`, field.options)
        let fixedOptions = "{}"
        if (typeof field.options === 'string' && !field.options.startsWith('{') && !field.options.startsWith('[')) {
           fixedOptions = "{}" // Just fallback to empty obj for safety
        }
        await prisma.tableField.update({
          where: { id: field.id },
          data: { options: fixedOptions }
        })
        invalidFields++
      }
    } else if (field.options === "") {
        await prisma.tableField.update({
            where: { id: field.id },
            data: { options: null as any }
        })
        invalidFields++
    }
  }
  
  console.log(`Fixed ${invalidFields} invalid TableField options entries.`)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
