import { FieldType, FieldValidationResult } from '../FieldType'
import { resolveChoices } from './selectChoices'

export { extractChoices } from './selectChoices'

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export class SingleSelectFieldType implements FieldType {
  readonly type = 'single_select'
  readonly name = '單選'
  readonly readOnly = false

  validateValue(value: unknown, options: unknown): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    const { ids, unknown } = resolveChoices(value, options, 'single')
    if (unknown.length > 0) {
      return { valid: false, code: 'unknown_option', error: `選項「${unknown[0]}」不存在` }
    }
    return { valid: true, parsedValue: ids[0] ?? null }
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
