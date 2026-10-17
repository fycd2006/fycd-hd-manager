import { FieldType, FieldValidationResult } from '../FieldType'

export class UrlFieldType implements FieldType {
  readonly type = 'url'
  readonly name = '網址'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined) return { valid: true, parsedValue: null }
    const str = String(value).trim()
    if (str === '') return { valid: true, parsedValue: null }

    const candidate = str.includes(':') ? str : `https://${str}`
    let url: URL
    try {
      url = new URL(candidate)
    } catch {
      return { valid: false, code: 'invalid_url', error: '網址格式不正確' }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, code: 'invalid_url', error: '網址只能使用 http 或 https' }
    }
    return { valid: true, parsedValue: candidate }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(2048)'
  }
}
