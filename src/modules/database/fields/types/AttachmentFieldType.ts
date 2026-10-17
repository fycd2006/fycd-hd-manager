import { FieldType, FieldValidationResult } from '../FieldType'

const invalidFormat = (): FieldValidationResult => ({
  valid: false,
  code: 'invalid_format',
  error: '附件格式不正確，每個附件都必須包含 url',
})

/** http(s) and blob: (browser uploads) and site-relative paths are allowed; javascript:, data: etc. are not. */
function isSafeUrl(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:' || protocol === 'blob:'
  } catch {
    return false
  }
}

export class AttachmentFieldType implements FieldType {
  readonly type = 'attachment'
  readonly name = '附件'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined || value === '') return { valid: true, parsedValue: null }

    let list: unknown = value
    if (typeof value === 'string') {
      try {
        list = JSON.parse(value)
      } catch {
        return invalidFormat()
      }
    }
    if (!Array.isArray(list)) return invalidFormat()

    for (const item of list) {
      if (typeof item !== 'object' || item === null) return invalidFormat()
      const url = (item as { url?: unknown }).url
      if (typeof url !== 'string' || url.trim() === '') return invalidFormat()
      if (!isSafeUrl(url.trim())) {
        return { valid: false, code: 'invalid_url', error: '附件網址不安全或格式不正確' }
      }
    }
    return { valid: true, parsedValue: list.length === 0 ? null : list }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }

  getGeneratedColumnSQLType(): string {
    return 'JSON'
  }
}
