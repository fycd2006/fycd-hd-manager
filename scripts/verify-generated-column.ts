import prisma from '../src/lib/prisma'

/**
 * Validates Generated Column support on the actual TiDB Serverless instance.
 * 
 * Steps:
 * 1. Create a temp table with a Generated Column
 * 2. Create an index on that generated column
 * 3. Insert test data
 * 4. Run EXPLAIN to prove the index is used
 * 5. Clean up
 */
async function verifyGeneratedColumn() {
  const TABLE_NAME = '_test_gencolumn_verify'

  try {
    // 1. Drop if exists from previous run
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${TABLE_NAME}`)
    console.log('[1] Dropped old test table (if any)')

    // 2. Create table with a Stored Generated Column extracting a JSON field
    await prisma.$executeRawUnsafe(`
      CREATE TABLE ${TABLE_NAME} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data JSON,
        field_1_gen VARCHAR(255) AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.field_1'))) STORED
      )
    `)
    console.log('[2] Created table with STORED Generated Column ✅')

    // 3. Create an index on the generated column
    await prisma.$executeRawUnsafe(`
      CREATE INDEX idx_field_1_gen ON ${TABLE_NAME} (field_1_gen)
    `)
    console.log('[3] Created index on Generated Column ✅')

    // 4. Insert test data
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${TABLE_NAME} (data) VALUES
        ('{"field_1": "alpha"}'),
        ('{"field_1": "beta"}'),
        ('{"field_1": "gamma"}')
    `)
    console.log('[4] Inserted 3 test rows')

    // 5. EXPLAIN a query that should use the generated column index
    const explainResult = await prisma.$queryRawUnsafe(
      `EXPLAIN SELECT * FROM ${TABLE_NAME} WHERE field_1_gen = 'beta'`
    )
    console.log('[5] EXPLAIN output:')
    console.log(JSON.stringify(explainResult, null, 2))

    // 6. Verify the index is actually used
    const usesIndex = JSON.stringify(explainResult).includes('idx_field_1_gen')
    if (usesIndex) {
      console.log('\n✅ CONFIRMED: TiDB uses the index on the Generated Column (idx_field_1_gen)')
    } else {
      console.log('\n⚠️  WARNING: Index does not appear in EXPLAIN output — needs investigation')
    }

    // 7. Cleanup
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${TABLE_NAME}`)
    console.log('[6] Cleaned up test table')

  } catch (e) {
    console.error('❌ Error during Generated Column verification:', e)
    // Attempt cleanup even on error
    try { await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${TABLE_NAME}`) } catch {}
  } finally {
    await prisma.$disconnect()
  }
}

verifyGeneratedColumn()
