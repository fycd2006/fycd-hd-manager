import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query'] });

async function run() {
  const dateStr = new Date('2023-10-31T00:00:00.000Z');
  console.log("Date parameter:", dateStr);
  
  const query = `
    EXPLAIN
    SELECT * FROM (
      SELECT id, tableId, data, createdAt FROM TableRow WHERE tableId = 10 AND deletedAt IS NULL
      UNION ALL
      SELECT id, tableId, data, createdAt FROM TableRow WHERE tableId = 11 AND deletedAt IS NULL
    ) AS master_union
    WHERE (createdAt, tableId, id) < (?, ?, ?)
    ORDER BY createdAt DESC, tableId DESC, id DESC
    LIMIT 10
  `;

  try {
    const explainResult: any = await prisma.$queryRawUnsafe(query, dateStr, 10, 500);
    console.log("EXPLAIN Output:\n", JSON.stringify(explainResult, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
