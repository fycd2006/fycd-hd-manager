import { FieldType, FieldValidationResult } from '../FieldType'

export class RatingFieldType implements FieldType {
  readonly type = 'rating'
  readonly name = '評分'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    const num = Math.round(Number(value))
    if (isNaN(num)) {
      return { valid: false, error: '必須是有效評分數字' }
    }
    let max = 5
    if (options) {
      const opts = typeof options === 'string' ? JSON.parse(options) : options
      max = opts?.max_value || opts?.max || 5
    }
    const clamped = Math.max(0, Math.min(max, num))
    return { valid: true, parsedValue: clamped }
  }

  formatValue(value: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'INT'
  }
}
