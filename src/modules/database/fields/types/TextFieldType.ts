import { FieldType, FieldValidationResult } from '../FieldType'

export class TextFieldType implements FieldType {
  readonly type = 'text'
  readonly name = '單行文字'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    const strVal = String(value)
    
    // Example constraint logic
    if (options && options.maxLength && strVal.length > options.maxLength) {
      return { valid: false, error: `文字長度不能超過 ${options.maxLength} 個字元` }
    }

    return { valid: true, parsedValue: strVal }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(255)'
  }
}
