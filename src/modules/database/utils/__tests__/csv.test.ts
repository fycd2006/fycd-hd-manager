/** @jest-environment jsdom */
import { parseCSVFile, parseCSVLine, csvRowToTableRow, exportToCSV } from '../csv'
import type { TableField, TableRow } from '../../types'

describe('CSV Utilities', () => {
  describe('parseCSVLine', () => {
    it('parses simple comma-separated line', () => {
      expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
    })

    it('handles quoted values with commas', () => {
      expect(parseCSVLine('"a,b",c,"d"')).toEqual(['a,b', 'c', 'd'])
    })

    it('handles escaped quotes inside quotes', () => {
      expect(parseCSVLine('"He said ""Hello""",world')).toEqual(['He said "Hello"', 'world'])
    })
  })

  describe('parseCSVFile', () => {
    it('strips UTF-8 BOM from start of CSV', () => {
      const csv = '\uFEFFName,Age,City\nAlice,30,Taipei\nBob,25,Tainan'
      const { headers, rows } = parseCSVFile(csv)

      expect(headers).toEqual(['Name', 'Age', 'City'])
      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual(['Alice', '30', 'Taipei'])
      expect(rows[1]).toEqual(['Bob', '25', 'Tainan'])
    })

    it('handles multiline cell values with embedded newlines', () => {
      const csv = `"ID","Title","Notes"
"1","Task A","First line
Second line
Third line"
"2","Task B","Single line"`

      const { headers, rows } = parseCSVFile(csv)

      expect(headers).toEqual(['ID', 'Title', 'Notes'])
      expect(rows).toHaveLength(2)
      expect(rows[0][0]).toBe('1')
      expect(rows[0][1]).toBe('Task A')
      expect(rows[0][2]).toBe('First line\nSecond line\nThird line')
      expect(rows[1][1]).toBe('Task B')
    })

    it('handles CRLF line endings', () => {
      const csv = 'Name,Score\r\nAlice,100\r\nBob,95\r\n'
      const { headers, rows } = parseCSVFile(csv)

      expect(headers).toEqual(['Name', 'Score'])
      expect(rows).toEqual([
        ['Alice', '100'],
        ['Bob', '95'],
      ])
    })

    it('throws error for empty file', () => {
      expect(() => parseCSVFile('')).toThrow('CSV 檔案為空')
      expect(() => parseCSVFile('   \n\r  ')).toThrow('CSV 檔案為空')
    })
  })

  describe('date fields', () => {
    const dateField: TableField = {
      id: 3,
      tableId: 1,
      name: 'When',
      type: 'date',
      order: 1,
      options: JSON.stringify({ date_include_time: true, date_format: 'us', date_time_zone: 'Asia/Taipei' }),
    }

    it('exports dates as ISO wall time in the field time zone', () => {
      let captured = ''
      const OriginalBlob = global.Blob
      global.Blob = class {
        constructor(parts: BlobPart[]) {
          captured = parts.join('')
        }
      } as unknown as typeof Blob
      const createUrl = jest.fn(() => 'blob:x')
      ;(URL as unknown as { createObjectURL: unknown }).createObjectURL = createUrl
      ;(URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = jest.fn()
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
      try {
        const rows = [
          { id: 1, tableId: 1, order: 0, createdAt: '', data: { field_3: '2026-10-18T06:30:00.000Z' } },
        ] as unknown as TableRow[]
        exportToCSV([dateField], rows, [], 't')
      } finally {
        global.Blob = OriginalBlob
        click.mockRestore()
      }
      expect(captured).toContain('"2026-10-18 14:30"')
    })

    it('imports wall time in the field time zone as a UTC instant', () => {
      expect(csvRowToTableRow(['2026-10-18 14:30'], ['When'], [dateField])).toEqual({
        field_3: '2026-10-18T06:30:00.000Z',
      })
    })

    it('keeps the raw string when the date cannot be parsed', () => {
      expect(csvRowToTableRow(['abc'], ['When'], [dateField])).toEqual({ field_3: 'abc' })
    })
  })

  describe('csvRowToTableRow', () => {
    const mockFields: TableField[] = [
      { id: 10, tableId: 1, name: '姓名', type: 'text', order: 1, options: null },
      { id: 11, tableId: 1, name: '年齡', type: 'number', order: 2, options: null },
      { id: 12, tableId: 1, name: '已繳費', type: 'boolean', order: 3, options: null },
      { id: 13, tableId: 1, name: '標籤', type: 'multiple_select', order: 4, options: null },
    ]

    it('maps fields by column header name even when CSV order is scrambled', () => {
      // CSV headers in different order: 已繳費, 姓名, 年齡
      const headers = ['已繳費', '姓名', '年齡']
      const csvRow = ['是', '王大明', '1,250']

      const result = csvRowToTableRow(csvRow, headers, mockFields)

      expect(result['field_10']).toBe('王大明')
      expect(result['field_11']).toBe('1,250')
      expect(result['field_12']).toBe('是')
    })

    it('trims values, leaves type judgement to the server, and splits multi-select tags', () => {
      const headers = ['姓名', '年齡', '已繳費', '標籤']
      const csvRow = ['李小華', '28', 'false', '開發, 設計; 行銷']

      const result = csvRowToTableRow(csvRow, headers, mockFields)

      expect(result['field_10']).toBe('李小華')
      expect(result['field_11']).toBe('28')
      expect(result['field_12']).toBe('false')
      expect(result['field_13']).toEqual(['開發', '設計', '行銷'])
    })

    it('does not pre-convert types: invalid numbers and booleans reach the server as trimmed text', () => {
      const headers = ['姓名', '年齡', '已繳費']
      const result = csvRowToTableRow(['  王小明  ', ' 十八 ', ' 也許 '], headers, mockFields)

      expect(result['field_10']).toBe('王小明')
      expect(result['field_11']).toBe('十八')
      expect(result['field_12']).toBe('也許')
    })

    it('supports positional fallback for backward compatibility', () => {
      // Positional: csvRow[0] -> fields[0], csvRow[1] -> fields[1]
      const csvRow = ['張三', '35', 'true']
      const result = csvRowToTableRow(csvRow, mockFields)

      expect(result['field_10']).toBe('張三')
      expect(result['field_11']).toBe('35')
      expect(result['field_12']).toBe('true')
    })
  })
})
