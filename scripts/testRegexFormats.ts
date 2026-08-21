import prisma from '../src/lib/prisma'

async function main() {
  const results = await prisma.$queryRaw<any[]>`
    SELECT 
      CASE WHEN '123' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('123' AS DECIMAL(30,10)) ELSE NULL END AS t1,
      CASE WHEN '-123' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('-123' AS DECIMAL(30,10)) ELSE NULL END AS t2,
      CASE WHEN '123.45' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('123.45' AS DECIMAL(30,10)) ELSE NULL END AS t3,
      CASE WHEN '-0.5' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('-0.5' AS DECIMAL(30,10)) ELSE NULL END AS t4,
      CASE WHEN '' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('' AS DECIMAL(30,10)) ELSE NULL END AS t5,
      CASE WHEN 'N/A' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('N/A' AS DECIMAL(30,10)) ELSE NULL END AS t6,
      CASE WHEN 'abc' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('abc' AS DECIMAL(30,10)) ELSE NULL END AS t7,
      CASE WHEN '$100' REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST('$100' AS DECIMAL(30,10)) ELSE NULL END AS t8
  `

  console.log('Regex results:', results)
  await prisma.$disconnect()
}

main().catch(console.error)

main().catch(console.error)
