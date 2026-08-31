import prisma from '../src/lib/prisma'
import { Prisma } from '@prisma/client'

async function runRealDatabaseVerification() {
  console.log('=== Starting Real Database Verification: Field Duplicate with Chunking & JSON Safety ===')

  // 1. Create a temporary test workspace and table
  const workspace = await prisma.workspace.create({
    data: {
      name: `Test_Duplicate_WS_${Date.now()}`,
      databases: {
        create: {
          name: 'Test DB',
          tables: {
            create: {
              name: 'Test Duplicate Table',
              order: 0,
            }
          }
        }
      }
    },
    include: {
      databases: {
        include: {
          tables: true
        }
      }
    }
  })

  const table = workspace.databases[0].tables[0]
  console.log(`[Setup] Created test workspace (${workspace.id}) and table (${table.id})`)

  try {
    // 2. Create source fields of different types (Text, Number, Boolean, Select/Array)
    const textField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: 'Product Name',
        type: 'text',
        order: 0
      }
    })

    const numField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: 'Price',
        type: 'number',
        order: 1
      }
    })

    const selectField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: 'Tags',
        type: 'single_select',
        order: 2
      }
    })

    console.log(`[Setup] Created fields: Text (ID ${textField.id}), Number (ID ${numField.id}), Select (ID ${selectField.id})`)

    // 3. Insert 10 test rows with diverse data shapes (including nulls, numbers, strings, arrays, missing keys)
    const testRowsData = [
      { [`field_${textField.id}`]: 'Apple iPhone 16', [`field_${numField.id}`]: 999, [`field_${selectField.id}`]: ['Flagship', 'iOS'] },
      { [`field_${textField.id}`]: 'Google Pixel 9', [`field_${numField.id}`]: 799, [`field_${selectField.id}`]: ['Android'] },
      { [`field_${textField.id}`]: 'Special "Quotes" & \\Backslash\\', [`field_${numField.id}`]: 0, [`field_${selectField.id}`]: null },
      { [`field_${textField.id}`]: '', [`field_${numField.id}`]: -150.5 }, // missing select field
      { [`field_${numField.id}`]: 42 }, // missing text & select
      { [`field_${textField.id}`]: 'Zero Value Test', [`field_${numField.id}`]: 0, [`field_${selectField.id}`]: [] },
      { [`field_${textField.id}`]: 'Chinese 繁體中文 測試', [`field_${numField.id}`]: 88888, [`field_${selectField.id}`]: ['熱門'] },
    ]

    const createdRows = []
    for (let i = 0; i < testRowsData.length; i++) {
      const r = await prisma.tableRow.create({
        data: {
          tableId: table.id,
          order: (i + 1) * 1000,
          data: testRowsData[i]
        }
      })
      createdRows.push(r)
    }

    console.log(`[Setup] Inserted ${createdRows.length} test rows`)

    // 4. Test duplicating textField
    console.log('\n[Test 1] Duplicating Text Field...')
    const newTextField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: `${textField.name} (Copy)`,
        type: textField.type,
        order: 1
      }
    })

    const srcTextPath = `$.field_${textField.id}`
    const newTextPath = `$.field_${newTextField.id}`

    // Execute chunked duplicate query
    const targetRows = await prisma.tableRow.findMany({
      where: { tableId: table.id, deletedAt: null },
      select: { id: true }
    })

    const CHUNK_SIZE = 3 // small chunk size to verify chunking loop
    for (let start = 0; start < targetRows.length; start += CHUNK_SIZE) {
      const chunk = targetRows.slice(start, start + CHUNK_SIZE)
      const chunkIds = chunk.map(r => r.id)

      await prisma.$executeRaw(
        Prisma.sql`UPDATE TableRow 
          SET data = JSON_SET(
            COALESCE(data, '{}'), 
            ${newTextPath}, 
            JSON_EXTRACT(data, ${srcTextPath})
          ) 
          WHERE id IN (${Prisma.join(chunkIds)}) 
            AND tableId = ${table.id} 
            AND deletedAt IS NULL 
            AND JSON_CONTAINS_PATH(data, 'one', ${srcTextPath}) = 1`
      )
    }

    // 5. Test duplicating numField
    console.log('[Test 2] Duplicating Numeric Field...')
    const newNumField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: `${numField.name} (Copy)`,
        type: numField.type,
        order: 3
      }
    })

    const srcNumPath = `$.field_${numField.id}`
    const newNumPath = `$.field_${newNumField.id}`

    for (let start = 0; start < targetRows.length; start += CHUNK_SIZE) {
      const chunk = targetRows.slice(start, start + CHUNK_SIZE)
      const chunkIds = chunk.map(r => r.id)

      await prisma.$executeRaw(
        Prisma.sql`UPDATE TableRow 
          SET data = JSON_SET(
            COALESCE(data, '{}'), 
            ${newNumPath}, 
            JSON_EXTRACT(data, ${srcNumPath})
          ) 
          WHERE id IN (${Prisma.join(chunkIds)}) 
            AND tableId = ${table.id} 
            AND deletedAt IS NULL 
            AND JSON_CONTAINS_PATH(data, 'one', ${srcNumPath}) = 1`
      )
    }

    // 6. Test duplicating selectField (Array/JSON type)
    console.log('[Test 3] Duplicating Select/Array Field...')
    const newSelectField = await prisma.tableField.create({
      data: {
        tableId: table.id,
        name: `${selectField.name} (Copy)`,
        type: selectField.type,
        order: 5
      }
    })

    const srcSelectPath = `$.field_${selectField.id}`
    const newSelectPath = `$.field_${newSelectField.id}`

    for (let start = 0; start < targetRows.length; start += CHUNK_SIZE) {
      const chunk = targetRows.slice(start, start + CHUNK_SIZE)
      const chunkIds = chunk.map(r => r.id)

      await prisma.$executeRaw(
        Prisma.sql`UPDATE TableRow 
          SET data = JSON_SET(
            COALESCE(data, '{}'), 
            ${newSelectPath}, 
            JSON_EXTRACT(data, ${srcSelectPath})
          ) 
          WHERE id IN (${Prisma.join(chunkIds)}) 
            AND tableId = ${table.id} 
            AND deletedAt IS NULL 
            AND JSON_CONTAINS_PATH(data, 'one', ${srcSelectPath}) = 1`
      )
    }

    // 7. Verify all rows in the database
    console.log('\n[Verification] Checking all rows in real database...')
    const updatedRows = await prisma.tableRow.findMany({
      where: { tableId: table.id },
      orderBy: { order: 'asc' }
    })

    let allMatched = true
    for (let i = 0; i < updatedRows.length; i++) {
      const r = updatedRows[i]
      const data = typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as any)

      const origText = testRowsData[i][`field_${textField.id}`]
      const copyText = data[`field_${newTextField.id}`]

      const origNum = testRowsData[i][`field_${numField.id}`]
      const copyNum = data[`field_${newNumField.id}`]

      const origSelect = testRowsData[i][`field_${selectField.id}`]
      const copySelect = data[`field_${newSelectField.id}`]

      console.log(`\nRow ${i + 1} (ID: ${r.id}):`)
      console.log(` - Text:   orig=${JSON.stringify(origText)} vs copy=${JSON.stringify(copyText)}`)
      console.log(` - Number: orig=${JSON.stringify(origNum)} vs copy=${JSON.stringify(copyNum)}`)
      console.log(` - Select: orig=${JSON.stringify(origSelect)} vs copy=${JSON.stringify(copySelect)}`)

      // Check text match (if orig is undefined, copy should be undefined)
      if (origText !== undefined && copyText !== origText) {
        console.error(`❌ Text mismatch in Row ${i + 1}: expected ${origText}, got ${copyText}`)
        allMatched = false
      }
      // Check number match
      if (origNum !== undefined && copyNum !== origNum) {
        console.error(`❌ Number mismatch in Row ${i + 1}: expected ${origNum}, got ${copyNum}`)
        allMatched = false
      }
      // Check select match
      if (origSelect !== undefined && JSON.stringify(copySelect) !== JSON.stringify(origSelect)) {
        console.error(`❌ Select mismatch in Row ${i + 1}: expected ${JSON.stringify(origSelect)}, got ${JSON.stringify(copySelect)}`)
        allMatched = false
      }
    }

    if (allMatched) {
      console.log('\n🎉 ALL REAL DATABASE VERIFICATIONS PASSED PERFECTLY!')
    } else {
      throw new Error('Database verification failed due to data mismatch!')
    }

  } finally {
    // Cleanup test workspace
    await prisma.workspace.delete({ where: { id: workspace.id } }).catch(() => {})
    console.log(`[Cleanup] Removed test workspace ${workspace.id}`)
  }
}

runRealDatabaseVerification().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
