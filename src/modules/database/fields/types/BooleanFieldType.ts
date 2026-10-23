import { FieldType, FieldValidationResult } from '../FieldType'

export const BOOLEAN_TRUE_WORDS: readonly string[] = ['true', '1', 'yes', 'y', '是', '勾選', 'v', '✓']
export const BOOLEAN_FALSE_WORDS: readonly string[] = ['false', '0', 'no', 'n', '否', 'x', '✗', '']

export class BooleanFieldType implements FieldType {
  readonly type = 'boolean'
  readonly name = '核取方塊'
  readonly readOnly = false

  validateValue(value: any): FieldValidationResult {
    if (value === null || value === undefined) {
      return { valid: true, parsedValue: false }
    }
    if (typeof value === 'boolean') {
      return { valid: true, parsedValue: value }
    }
    const str = String(value).toLowerCase().trim()
    if (BOOLEAN_TRUE_WORDS.includes(str)) return { valid: true, parsedValue: true }
    if (BOOLEAN_FALSE_WORDS.includes(str)) return { valid: true, parsedValue: false }
    return { valid: false, code: 'invalid_boolean', error: '必須是是／否值' }
  }

  formatValue(value: any): any {
    return Boolean(value)
  }

  getDefaultValue(): any {
    return false
  }

  getGeneratedColumnSQLType(): string {
    return 'TINYINT(1)'
  }
}
