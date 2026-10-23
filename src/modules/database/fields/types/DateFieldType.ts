import { FieldType, FieldValidationResult } from '../FieldType'
import { normalizeDateInput, resolveDateOptions } from '../../utils/dateTime'

export class DateFieldType implements FieldType {
  readonly type = 'date'
  readonly name = '日期'
  readonly readOnly = false

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }

    const parsedValue = normalizeDateInput(value, options)
    if (parsedValue === null) {
      const includeTime = resolveDateOptions(options).date_include_time
      return {
        valid: false,
        code: 'invalid_date',
        error: includeTime ? '必須是有效的日期時間（YYYY-MM-DD HH:mm）' : '必須是有效的日期（YYYY-MM-DD）',
      }
    }
    return { valid: true, parsedValue }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    if (options?.defaultValue === 'NOW') {
      if (resolveDateOptions(options).date_include_time) return new Date().toISOString()
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    }
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'DATE'
  }

  // 含時間欄位取到的是 UTC 日期，僅供索引，篩選不走此欄
  getGeneratedColumnSQLExpression(fieldKey: string): string {
    // Dates are stored as YYYY-MM-DD (legacy ISO strings: first 10 chars)
    return `CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(data, '$."${fieldKey}"')), 10) AS DATE)`
  }
}
