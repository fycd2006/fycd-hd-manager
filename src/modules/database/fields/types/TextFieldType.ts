import { FieldType, FieldValidationResult } from '../FieldType'

export class TextFieldType implements FieldType {
  readonly type: string = 'text'
  readonly name: string = '單行文字'
  readonly readOnly = false

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined) {
      return { valid: true, parsedValue: null }
    }
    const strVal = String(value).trim()
    if (strVal === '') {
      return { valid: true, parsedValue: null }
    }
    
    // Example constraint logic
    if (options && options.maxLength && strVal.length > options.maxLength) {
      return { valid: false, code: 'invalid_format', error: `文字長度不能超過 ${options.maxLength} 個字元` }
    }

    return { valid: true, parsedValue: strVal }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(255)'
  }
}
