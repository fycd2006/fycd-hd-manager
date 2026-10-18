import { FieldType, FieldValidationResult } from '../FieldType'

const DATE_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(T.*)?$/

export class DateFieldType implements FieldType {
  readonly type = 'date'
  readonly name = '日期'
  readonly readOnly = false

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }

    const invalid: FieldValidationResult = {
      valid: false,
      code: 'invalid_date',
      error: '必須是有效的日期（YYYY-MM-DD）',
    }
    const match = typeof value === 'string' ? DATE_PATTERN.exec(value.trim()) : null
    if (!match) return invalid

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const check = new Date(Date.UTC(year, month - 1, day))
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return invalid
    }

    const pad = (n: number, len: number) => String(n).padStart(len, '0')
    return { valid: true, parsedValue: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    if (options?.defaultValue === 'NOW') {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    }
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'DATE'
  }
  
  getGeneratedColumnSQLExpression(fieldKey: string): string {
    // Dates are stored as YYYY-MM-DD (legacy ISO strings: first 10 chars)
    return `CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(data, '$."${fieldKey}"')), 10) AS DATE)`
  }
}
