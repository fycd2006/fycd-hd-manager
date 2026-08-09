import prisma from '@/lib/prisma'
import { FieldRegistry } from '../fields/types'

/**
 * Creates a Generated Column and Index on the TableRow table for a given field.
 * This is used for TiDB high-speed JSON queries.
 */
export async function createGeneratedColumn(fieldId: number) {
  if (!Number.isInteger(fieldId)) {
    throw new Error('fieldId 必須是整數')
  }

  const field = await prisma.tableField.findUnique({ where: { id: fieldId } })
  if (!field) throw new Error('Field not found')

  // Block long text from being indexed due to 255 char limit and index size limits
  if (field.type === 'long_text' || field.type === 'rich_text') {
    throw new Error(`欄位型別 ${field.type} 不支援建立索引`)
  }

  const fieldKey = `field_${field.id}`
  const columnName = `gen_${fieldKey}`
  const indexName = `idx_${fieldKey}`

  const fieldType = FieldRegistry.get(field.type)
  const sqlType = fieldType.getGeneratedColumnSQLType ? fieldType.getGeneratedColumnSQLType() : 'VARCHAR(255)'
  const sqlExtract = fieldType.getGeneratedColumnSQLExpression ? 
    fieldType.getGeneratedColumnSQLExpression(fieldKey) : 
    `JSON_UNQUOTE(JSON_EXTRACT(data, '$."${fieldKey}"'))`

  // 1. Add Generated Column
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE TableRow 
      ADD COLUMN ${columnName} ${sqlType} AS (${sqlExtract}) VIRTUAL
    `)
  } catch (err: any) {
    if (err.message && err.message.includes('Duplicate column name')) {
      console.warn(`[SchemaService] Column ${columnName} already exists.`)
    } else {
      throw err
    }
  }

  // 2. Add Index
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX ${indexName} ON TableRow (${columnName})
    `)
  } catch (err: any) {
    if (err.message && err.message.includes('Duplicate key name')) {
      console.warn(`[SchemaService] Index ${indexName} already exists.`)
    } else {
      throw err
    }
  }
}

/**
 * Drops the Generated Column and Index for a given field.
 */
export async function dropGeneratedColumn(fieldId: number) {
  if (!Number.isInteger(fieldId)) {
    throw new Error('fieldId 必須是整數')
  }

  const fieldKey = `field_${fieldId}`
  const columnName = `gen_${fieldKey}`
  const indexName = `idx_${fieldKey}`

  try {
    // Dropping column usually drops the associated index automatically in MySQL/TiDB
    await prisma.$executeRawUnsafe(`
      ALTER TABLE TableRow 
      DROP COLUMN ${columnName}
    `)
  } catch (err: any) {
    if (err.message && err.message.includes('check that column/key exists')) {
      console.warn(`[SchemaService] Column ${columnName} does not exist to drop.`)
    } else {
      throw err
    }
  }
}
