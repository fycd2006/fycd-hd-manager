/**
 * Database Module - CSV Import/Export Utilities
 * Handles CSV parsing and generation for table data
 */

import { TableField, TableRow, CellValue } from '../types'

/**
 * Parse CSV line handling quoted fields
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result.map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'))
}

/**
 * Export table data to CSV format
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
              return (item as any).value || (item as any).name || ''
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
 * Parse CSV file and return structured data
 */
export const parseCSVFile = (text: string): { headers: string[]; rows: string[][] } => {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length === 0) {
    throw new Error('CSV 檔案為空')
  }

  const headers = parseCSVLine(lines[0])
  const rows = lines.slice(1).map(line => parseCSVLine(line))

  return { headers, rows }
}

/**
 * Convert CSV row data to table row format
 */
export const csvRowToTableRow = (
  csvRow: string[],
  fields: TableField[]
): Record<string, CellValue> => {
  const data: Record<string, CellValue> = {}

  fields.forEach((field, index) => {
    const key = `field_${field.id}`
    const value = csvRow[index] || ''

    // Convert based on field type
    switch (field.type) {
      case 'boolean':
        data[key] = value.toLowerCase() === 'true' || value === '1'
        break
      case 'number':
        const num = Number(value)
        data[key] = isNaN(num) ? null : num
        break
      case 'multiple_select':
        data[key] = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
        break
      case 'link_row':
        data[key] = []
        break
      default:
        data[key] = value
    }
  })

  return data
}
