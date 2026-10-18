import { FieldType, FieldValidationResult } from '../FieldType'
import { parseNumberText } from './NumberFieldType'

export class RatingFieldType implements FieldType {
  readonly type = 'rating'
  readonly name = '評分'
  readonly readOnly = false

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    const num = parseNumberText(value)
    if (num === 'invalid') {
      return { valid: false, code: 'invalid_number', error: '必須是有效評分數字' }
    }
    if (num === null) {
      return { valid: true, parsedValue: null }
    }
    let max = 5
    if (options) {
      const opts = typeof options === 'string' ? JSON.parse(options) : options
      const configured = Number(opts?.max_value ?? opts?.max)
      max = configured > 0 ? configured : 5
    }
    if (!Number.isInteger(num) || num < 0 || num > max) {
      return { valid: false, code: 'out_of_range', error: `超出允許範圍（0–${max}）` }
    }
    return { valid: true, parsedValue: num }
  }

  formatValue(value: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'INT'
  }
}
