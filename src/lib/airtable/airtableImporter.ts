/**
 * Airtable Import Engine
 * Translates Airtable schemas, fields, options, and records into internal database models.
 * Modeled after Baserow's two-pass import architecture.
 */

export interface AirtableFieldRaw {
  id: string
  name: string
  type: string
  options?: {
    choices?: Array<{ id: string; name: string; color?: string }>
    linkedTableId?: string
    isReversed?: boolean
    formula?: string
  }
}

export interface AirtableTableRaw {
  id: string
  name: string
  fields: AirtableFieldRaw[]
  records: Array<{
    id: string
    cellValuesByFieldId: Record<string, any>
  }>
}

export interface AirtableBasePayload {
  name?: string
  tables: AirtableTableRaw[]
}

export interface ConvertedField {
  name: string
  type: string
  airtableId: string
  options?: any
}

export interface ConvertedTable {
  name: string
  airtableId: string
  fields: ConvertedField[]
  rows: Array<{
    airtableId: string
    data: Record<string, any>
  }>
}

/**
 * Maps Airtable field types to internal system field types
 */
export function mapAirtableFieldToInternal(airtableType: string): { type: string; defaultOptions?: any } {
  switch (airtableType) {
    case 'singleLineText':
    case 'multilineText':
    case 'richText':
    case 'email':
    case 'url':
    case 'phoneNumber':
      return { type: 'text' }
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'count':
    case 'autoNumber':
      return { type: 'number' }
    case 'singleSelect':
      return { type: 'single_select' }
    case 'multipleSelects':
      return { type: 'multiple_select' }
    case 'multipleRecordLinks':
      return { type: 'link_row' }
    case 'formula':
      return { type: 'formula' }
    case 'date':
    case 'dateTime':
    case 'createdTime':
    case 'lastModifiedTime':
      return { type: 'date' }
    case 'checkbox':
      return { type: 'checkbox' }
    case 'multipleAttachments':
      return { type: 'file' }
    default:
      return { type: 'text' }
  }
}

/**
 * Parses and transforms raw Airtable JSON payload into internal Schema structure
 */
export function parseAirtableBasePayload(payload: AirtableBasePayload): ConvertedTable[] {
  if (!payload || !Array.isArray(payload.tables)) {
    throw new Error('無效的 Airtable Base 資料結構')
  }

  return payload.tables.map(table => {
    const convertedFields: ConvertedField[] = table.fields.map(field => {
      const { type } = mapAirtableFieldToInternal(field.type)
      return {
        name: field.name || '未命名欄位',
        type,
        airtableId: field.id,
        options: field.options || null,
      }
    })

    const convertedRows = (table.records || []).map(record => {
      const rowData: Record<string, any> = {}
      table.fields.forEach(field => {
        const val = record.cellValuesByFieldId[field.id]
        if (val !== undefined) {
          rowData[field.name] = val
        }
      })
      return {
        airtableId: record.id,
        data: rowData,
      }
    })

    return {
      name: table.name || '未命名表格',
      airtableId: table.id,
      fields: convertedFields,
      rows: convertedRows,
    }
  })
}
