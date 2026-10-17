import { FieldType, FieldValidationResult } from '../FieldType'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class EmailFieldType implements FieldType {
  readonly type = 'email'
  readonly name = '電子郵件'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined) return { valid: true, parsedValue: null }
    const str = String(value).trim()
    if (str === '') return { valid: true, parsedValue: null }
    if (!EMAIL_RE.test(str)) {
      return { valid: false, code: 'invalid_email', error: '電子郵件格式不正確' }
    }
    return { valid: true, parsedValue: str.toLowerCase() }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(255)'
  }
}
