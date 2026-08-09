import { FieldType, FieldValidationResult } from '../FieldType'

export class NumberFieldType implements FieldType {
  readonly type = 'number'
  readonly name = '數字'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    
    const numVal = Number(value)
    if (isNaN(numVal)) {
      return { valid: false, error: '必須是有效的數字' }
    }

    if (options) {
      if (options.min !== undefined && numVal < options.min) {
        return { valid: false, error: `不能小於 ${options.min}` }
      }
      if (options.max !== undefined && numVal > options.max) {
        return { valid: false, error: `不能大於 ${options.max}` }
      }
    }

    return { valid: true, parsedValue: numVal }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'DECIMAL(20,6)'
  }
}
