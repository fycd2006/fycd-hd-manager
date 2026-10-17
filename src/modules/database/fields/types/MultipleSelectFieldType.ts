import { FieldType, FieldValidationResult } from '../FieldType'
import { resolveChoices } from './selectChoices'

export class MultipleSelectFieldType implements FieldType {
  readonly type = 'multiple_select'
  readonly name = '多選'
  readonly readOnly = false

  validateValue(value: unknown, options: unknown): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    const { ids, unknown } = resolveChoices(value, options, 'multi')
    if (unknown.length > 0) {
      return { valid: false, code: 'unknown_option', error: `選項「${unknown.join('、')}」不存在` }
    }
    return { valid: true, parsedValue: ids.length ? JSON.stringify(ids) : null }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'JSON'
  }
}
