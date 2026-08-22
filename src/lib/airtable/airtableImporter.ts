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
    // ── Text ──
    case 'text':              // v0.3 internal
    case 'singleLineText':    // REST API
      return { type: 'text' }
    case 'multilineText':
    case 'richText':
      return { type: 'long_text' }
    case 'email':
      return { type: 'email' }
    case 'url':
      return { type: 'url' }
    case 'phone':             // v0.3 internal
    case 'phoneNumber':       // REST API
      return { type: 'phone' }

    // ── Numeric ──
    case 'number':
    case 'currency':
    case 'percent':
      return { type: 'number' }
    case 'rating':
      return { type: 'rating' }
    case 'count':
      return { type: 'count' }
    case 'autoNumber':
      return { type: 'autonumber' }
    case 'duration':
      return { type: 'duration' }

    // ── Select ──
    case 'select':            // v0.3 internal
    case 'singleSelect':      // REST API
      return { type: 'single_select' }
    case 'multiSelect':       // v0.3 internal
    case 'multipleSelects':   // REST API
      return { type: 'multiple_select' }

    // ── Relations & Computed ──
    case 'foreignKey':        // v0.3 internal
    case 'multipleRecordLinks': // REST API
      return { type: 'link_row' }
    case 'formula':
      return { type: 'formula' }
    case 'rollup':
      return { type: 'rollup' }
    case 'lookup':
      return { type: 'lookup' }

    // ── Date / Time ──
    case 'date':
    case 'dateTime':
      return { type: 'date' }
    case 'createdTime':
      return { type: 'created_on' }
    case 'lastModifiedTime':
      return { type: 'last_modified_on' }

    // ── Collaborator & Audit ──
    case 'collaborator':
    case 'singleCollaborator':
    case 'multipleCollaborators':
      return { type: 'collaborator' }
    case 'createdBy':
      return { type: 'created_by' }
    case 'lastModifiedBy':
      return { type: 'last_modified_by' }

    // ── Boolean & Files ──
    case 'checkbox':
      return { type: 'boolean' }
    case 'multipleAttachment':  // v0.3 internal
    case 'multipleAttachments': // REST API
      return { type: 'file' }

    default:
      return { type: 'text' }
  }
}
/**
 * Determine the "canonical" Airtable category for a raw field type string.
 * Maps both v0.3 internal names and REST API names to a single key
 * so convertCellValue only needs one switch.
 */
function canonicalCategory(rawType: string): string {
  switch (rawType) {
    case 'select':
    case 'singleSelect':
      return 'select'
    case 'multiSelect':
    case 'multipleSelects':
      return 'multiSelect'
    case 'foreignKey':
    case 'multipleRecordLinks':
      return 'foreignKey'
    case 'date':
    case 'dateTime':
    case 'createdTime':
    case 'lastModifiedTime':
      return 'date'
    case 'checkbox':
      return 'checkbox'
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'count':
    case 'autoNumber':
      return 'number'
    case 'formula':
    case 'rollup':
    case 'lookup':
      return 'computed'
    case 'multipleAttachment':
    case 'multipleAttachments':
      return 'attachment'
    case 'collaborator':
    case 'singleCollaborator':
    case 'multipleCollaborators':
    case 'createdBy':
    case 'lastModifiedBy':
      return 'collaborator'
    default:
      return 'text'
  }
}

/**
 * Converts a raw Airtable cell value into a format our system can render.
 *
 * Handles both v0.3 internal API formats and REST API formats:
 * - Select: choice IDs ("selXXX") → resolved to display names via choices map
 * - Linked records (foreignKey): [{foreignRowId: "recXXX"}] → comma-separated IDs
 * - Formulas/Rollups/Lookups: objects → flattened scalars
 * - Dates: strings or {dateTime, tz} objects → ISO strings
 * - Attachments: [{id, url, filename}] → [{url, name}]
 * - Checkbox: true/undefined → boolean
 */
function convertCellValue(
  val: any,
  field: AirtableFieldRaw
): any {
  if (val === null || val === undefined) return val

  const category = canonicalCategory(field.type)

  switch (category) {
    case 'select': {
      // val is a choice ID like "selXXX" — resolve to display name
      const choicesMap = buildChoicesMap(field)
      if (typeof val === 'string' && choicesMap.size > 0) {
        return choicesMap.get(val) ?? val
      }
      return val
    }

    case 'multiSelect': {
      // val is an array of choice IDs
      const choicesMap = buildChoicesMap(field)
      if (Array.isArray(val)) {
        return val.map(v => {
          if (typeof v === 'string' && choicesMap.size > 0) {
            return choicesMap.get(v) ?? v
          }
          return typeof v === 'object' ? (v?.name ?? v?.id ?? String(v)) : v
        })
      }
      // Single string value (edge case)
      if (typeof val === 'string' && choicesMap.size > 0) {
        return [choicesMap.get(val) ?? val]
      }
      return val
    }

    case 'foreignKey': {
      // v0.3: val is an array of objects [{foreignRowId: "recXXX", foreignRowDisplayName: "..."}, ...]
      // REST: val is an array of record ID strings ["recXXX", "recYYY"]
      if (Array.isArray(val)) {
        return val.map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.foreignRowDisplayName ?? v.name ?? v.foreignRowId ?? v.id ?? JSON.stringify(v)
          }
          return String(v)
        }).join(', ')
      }
      if (typeof val === 'object' && val !== null) {
        return val.foreignRowDisplayName ?? val.name ?? val.foreignRowId ?? val.id ?? JSON.stringify(val)
      }
      return String(val)
    }

    case 'date': {
      if (typeof val === 'string') return val
      if (typeof val === 'object' && val !== null) {
        return val.dateTime ?? val.date ?? val.value ?? JSON.stringify(val)
      }
      return String(val)
    }

    case 'checkbox': {
      return val === true
    }

    case 'number': {
      if (typeof val === 'number') return val
      if (typeof val === 'object' && val !== null) {
        return val.value ?? val.specialValue ?? null
      }
      return val
    }

    case 'computed': {
      return flattenComputedValue(val)
    }

    case 'attachment': {
      if (Array.isArray(val)) {
        return val.map(att => ({
          url: att?.url ?? att?.thumbnails?.large?.url ?? '',
          name: att?.filename ?? att?.name ?? 'attachment',
        }))
      }
      return val
    }

    case 'collaborator': {
      if (Array.isArray(val)) {
        return val
          .map(u => (typeof u === 'object' && u !== null ? (u.name ?? u.email ?? u.id ?? JSON.stringify(u)) : String(u)))
          .join(', ')
      }
      if (typeof val === 'object' && val !== null) {
        return val.name ?? val.email ?? val.id ?? JSON.stringify(val)
      }
      return val
    }

    default: {
      // text and unknown types — flatten objects to strings
      if (typeof val === 'object' && val !== null) {
        if (Array.isArray(val)) {
          return val.map(v =>
            typeof v === 'object'
              ? (v?.foreignRowDisplayName ?? v?.name ?? v?.value ?? v?.foreignRowId ?? v?.id ?? JSON.stringify(v))
              : String(v)
          ).join(', ')
        }
        return val.foreignRowDisplayName ?? val.value ?? val.name ?? val.text ?? val.foreignRowId ?? JSON.stringify(val)
      }
      return val
    }
  }
}

/**
 * Build a lookup map from choice ID -> choice name for select fields
 */
function buildChoicesMap(field: AirtableFieldRaw): Map<string, string> {
  const map = new Map<string, string>()
  if (!field.options?.choices) return map
  for (const choice of field.options.choices) {
    if (choice.id && choice.name) {
      map.set(choice.id, choice.name)
    }
  }
  return map
}

/**
 * Flatten a formula / rollup / lookup computed value to a displayable scalar
 */
function flattenComputedValue(val: any): any {
  if (val === null || val === undefined) return null
  if (typeof val !== 'object') return val

  // Array of values — flatten each and join
  if (Array.isArray(val)) {
    return val.map(v => flattenComputedValue(v)).filter(v => v !== null && v !== undefined).join(', ')
  }

  // Object with specialValue (e.g., {specialValue: "NaN"} or {specialValue: "#ERROR!"})
  if ('specialValue' in val) return val.specialValue
  // Object with value
  if ('value' in val) return val.value
  // Object with name
  if ('name' in val) return val.name
  // Object with text
  if ('text' in val) return val.text

  return JSON.stringify(val)
}

/**
 * Parses and transforms raw Airtable JSON payload into internal Schema structure
 */
export function parseAirtableBasePayload(payload: AirtableBasePayload): ConvertedTable[] {
  if (!payload || !Array.isArray(payload.tables)) {
    throw new Error('無效的 Airtable Base 資料結構')
  }

  return payload.tables.map(table => {
    // Build a field ID -> field definition lookup for cell value conversion
    const fieldById = new Map<string, AirtableFieldRaw>()
    for (const field of table.fields) {
      fieldById.set(field.id, field)
    }

    const convertedFields: ConvertedField[] = table.fields.map(field => {
      const { type } = mapAirtableFieldToInternal(field.type)

      // For select fields, preserve choices with id, name, and color
      let options: any = field.options || null
      if ((type === 'single_select' || type === 'multiple_select') && field.options?.choices) {
        options = {
          choices: field.options.choices
            .map(c => ({
              id: c.id || `opt_${Math.random().toString(36).slice(2, 9)}`,
              name: c.name,
              color: c.color || undefined,
            }))
            .filter(c => Boolean(c.name)),
        }
      }

      return {
        name: field.name || '未命名欄位',
        type,
        airtableId: field.id,
        options,
      }
    })

    const convertedRows = (table.records || []).map(record => {
      const rowData: Record<string, any> = {}
      table.fields.forEach(field => {
        const rawVal = record.cellValuesByFieldId[field.id]
        if (rawVal !== undefined) {
          rowData[field.name] = convertCellValue(rawVal, field)
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
