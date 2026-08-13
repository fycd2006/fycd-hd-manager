import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log("Setting up test data...");
  // Use a transaction or just create some rows for tableId = 9999 to avoid conflict
  const testTableId = 9999;
  
  // Cleanup
  await prisma.tableRow.deleteMany({ where: { tableId: testTableId } });
  
  // Ensure the table exists if needed by FK (DatabaseTable), assuming cascade or ignoring if we just create the table.
  let table = await prisma.databaseTable.findUnique({ where: { id: testTableId } });
  if (!table) {
    // try to find a DB
    const db = await prisma.database.findFirst();
    if (!db) {
       console.log("No DB found"); return;
    }
    table = await prisma.databaseTable.create({
      data: { id: testTableId, name: 'TestTable', databaseId: db.id }
    });
  }

  // Create 5 rows with slightly different timestamps
  const baseTime = Date.now();
  for (let i = 0; i < 5; i++) {
    await prisma.tableRow.create({
      data: {
        tableId: testTableId,
        data: { val: i },
        createdAt: new Date(baseTime + i * 1000) // 1 second apart
      }
    });
  }

  console.log("Fetching Page 1 (Limit 2)...");
  
  const page1Query = `
    SELECT id, tableId, data, createdAt FROM TableRow
    WHERE tableId = ? AND deletedAt IS NULL
    ORDER BY createdAt DESC, tableId DESC, id DESC
    LIMIT 2
  `;
  const page1: any[] = await prisma.$queryRawUnsafe(page1Query, testTableId);
  console.log("Page 1 results:");
  page1.forEach(r => console.log(`  id: ${r.id}, createdAt: ${r.createdAt.toISOString()}`));

  if (page1.length === 0) return;

  // Generate cursor from the last item of page 1
  const lastItem = page1[page1.length - 1];
  const cursorDateStr = lastItem.createdAt.toISOString();
  
  console.log(`\nFetching Page 2 using Cursor: (createdAt < ${cursorDateStr}, id < ${lastItem.id})...`);
  
  const page2Query = `
    SELECT id, tableId, data, createdAt FROM TableRow
    WHERE tableId = ? AND deletedAt IS NULL
      AND (createdAt, tableId, id) < (?, ?, ?)
    ORDER BY createdAt DESC, tableId DESC, id DESC
    LIMIT 2
  `;
  const page2: any[] = await prisma.$queryRawUnsafe(page2Query, testTableId, lastItem.createdAt, lastItem.tableId, lastItem.id);
  
  console.log("Page 2 results:");
  page2.forEach(r => console.log(`  id: ${r.id}, createdAt: ${r.createdAt.toISOString()}`));
  
  console.log("\nVerifying Page 2 strictly follows Page 1...");
  if (page2.length > 0 && page1[1].createdAt.getTime() > page2[0].createdAt.getTime()) {
    console.log("SUCCESS: Page 2's first item is older than Page 1's last item.");
  } else if (page2.length > 0 && page1[1].createdAt.getTime() === page2[0].createdAt.getTime() && page1[1].id > page2[0].id) {
    console.log("SUCCESS: Page 2's first item has same timestamp but smaller ID.");
  } else {
    console.log("FAIL: Pagination is broken or overlapping.");
  }
  
  // Cleanup
  await prisma.tableRow.deleteMany({ where: { tableId: testTableId } });
  await prisma.databaseTable.delete({ where: { id: testTableId } });
}

run().catch(console.error).finally(() => prisma.$disconnect());
