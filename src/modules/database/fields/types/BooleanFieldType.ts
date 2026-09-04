import { FieldType, FieldValidationResult } from '../FieldType'

export class BooleanFieldType implements FieldType {
  readonly type = 'boolean'
  readonly name = '核取方塊'

  validateValue(value: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: false }
    }
    if (typeof value === 'boolean') {
      return { valid: true, parsedValue: value }
    }
    const str = String(value).toLowerCase().trim()
    const isTrue =
      str === 'true' ||
      str === '1' ||
      str === 'yes' ||
      str === 'y' ||
      str === '是' ||
      str === '勾選' ||
      str === 'v' ||
      str === '✓'
    return { valid: true, parsedValue: isTrue }
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
