import { FieldType, FieldValidationResult } from '../FieldType'

export class PhoneNumberFieldType implements FieldType {
  readonly type = 'phone_number'
  readonly name = '電話號碼'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined) return { valid: true, parsedValue: null }
    const str = String(value).trim()
    if (str === '') return { valid: true, parsedValue: null }
    const digits = str.replace(/\D/g, '')
    if (!/^[0-9+\-()\s]+$/.test(str) || digits.length < 6) {
      return { valid: false, code: 'invalid_phone', error: '電話號碼格式不正確' }
    }
    return { valid: true, parsedValue: str }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(64)'
  }
}
