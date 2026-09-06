/**
 * Database Module - CSV Import/Export Utilities
 * Handles RFC 4180 compliant CSV parsing, generation, and data type mapping for tables.
 */

import { TableField, TableRow, CellValue } from '../types'

/**
 * Parse a single CSV line handling quoted fields and escaped quotes
 */
export const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++ // Skip escaped quote ""
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Export table data to CSV format with UTF-8 BOM for Excel compatibility
 */
export const exportToCSV = (
  fields: TableField[],
  rows: TableRow[],
  hiddenFieldKeys: string[],
  tableName: string
): void => {
  if (fields.length === 0) {
    throw new Error('沒有欄位可導出')
  }

  const visibleFields = fields.filter(f => !hiddenFieldKeys.includes(`field_${f.id}`))
  const headers = visibleFields.map(f => `"${f.name.replace(/"/g, '""')}"`).join(',')

  const csvRows = rows.map(row => {
    return visibleFields.map(field => {
      const val = row.data[`field_${field.id}`]
      let valStr = ''
      if (val != null) {
        if (Array.isArray(val)) {
          valStr = val.map(item => {
            if (item && typeof item === 'object' && !Array.isArray(item)) {
              const obj = item as Record<string, unknown>
              if (obj.content !== undefined && obj.content !== null) {
                const userStr = obj.user ? ` (${obj.user})` : ''
                const timeStr = obj.time ? `[${obj.time}] ` : ''
                return `${timeStr}${obj.content}${userStr}`
              }
              return String(obj.value || obj.name || '')
            }
            return String(item)
          }).join('; ')
        } else {
          valStr = String(val)
        }
      }
      return `"${valStr.replace(/"/g, '""')}"`
    }).join(',')
  })

  const csvContent = '\uFEFF' + [headers, ...csvRows].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${tableName || 'export'}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Parse CSV file and return structured data.
 * Fully RFC 4180 compliant: handles UTF-8 BOM, multiline cells in quotes, and escaped quotes ("").
 */
export const parseCSVFile = (text: string): { headers: string[]; rows: string[][] } => {
  if (!text || !text.trim()) {
    throw new Error('CSV 檔案為空')
  }

  // 1. Strip UTF-8 BOM if present (added by Excel)
  const cleanText = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // Skip escaped quote ""
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++ // Skip \r\n
      }
      currentRow.push(currentCell.trim())
      currentCell = ''
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
    } else {
      currentCell += char
    }
  }

  // Flush remaining cell/row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  if (rows.length === 0) {
    throw new Error('CSV 檔案為空')
  }

  const rawHeaders = rows[0]
  const headers = rawHeaders.map(h => h.trim())
  const dataRows = rows.slice(1)

  return { headers, rows: dataRows }
}

/**
 * Helper to convert raw string value to typed cell value
 */
function convertCSVValue(rawValue: string, field: TableField): CellValue {
  const trimmed = rawValue.trim()
  switch (field.type) {
    case 'boolean':
      return (
        trimmed.toLowerCase() === 'true' ||
        trimmed === '1' ||
        trimmed === '是' ||
        trimmed.toLowerCase() === 'yes' ||
        trimmed.toLowerCase() === 'y'
      )
    case 'number':
    case 'rating': {
      if (trimmed === '') return null
      const cleanNumStr = trimmed.replace(/,/g, '')
      const num = Number(cleanNumStr)
      return isNaN(num) ? null : num
    }
    case 'multiple_select':
      return trimmed ? trimmed.split(/[,;]/).map(v => v.trim()).filter(Boolean) : []
    case 'link_row':
      return []
    default:
      return rawValue
  }
}

/**
 * Convert CSV row data to table row format.
 * Supports both:
 * 1. Name-based matching: csvRowToTableRow(csvRow, headers, fields) -> RECOMMENDED
 * 2. Positional matching: csvRowToTableRow(csvRow, fields) -> Backward compatible
 */
export function csvRowToTableRow(
  csvRow: string[],
  headersOrFields: string[] | TableField[],
  fieldsArg?: TableField[]
): Record<string, CellValue> {
  // If called with (csvRow, headers, fields)
  if (Array.isArray(headersOrFields) && typeof headersOrFields[0] === 'string') {
    const headers = headersOrFields as string[]
    const fields = fieldsArg || []
    const fieldByName = new Map(fields.map(f => [f.name.trim().toLowerCase(), f]))
    const data: Record<string, CellValue> = {}

    headers.forEach((headerName, colIndex) => {
      const cleanHeader = headerName.trim().toLowerCase()
      const field = fieldByName.get(cleanHeader)
      if (!field) return

      const key = `field_${field.id}`
      const rawValue = csvRow[colIndex] ?? ''
      data[key] = convertCSVValue(rawValue, field)
    })

    return data
  }

  // Fallback: positional matching if called with (csvRow, fields)
  const fields = headersOrFields as TableField[]
  const data: Record<string, CellValue> = {}

  fields.forEach((field, index) => {
    const key = `field_${field.id}`
    const rawValue = csvRow[index] ?? ''
    data[key] = convertCSVValue(rawValue, field)
  })

  return data
}
