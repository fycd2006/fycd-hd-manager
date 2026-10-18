import { FieldType, FieldValidationResult } from '../FieldType'

const invalid = (): FieldValidationResult => ({
  valid: false,
  code: 'invalid_format',
  error: '關聯欄位格式不正確，必須是列 ID 的陣列',
})

function isLinkItem(item: unknown): boolean {
  if (typeof item === 'number' || typeof item === 'string') return true
  if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
    const id = (item as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string'
  }
  return false
}

/** Shape check only; the actual relation is written by linkRowSync. */
export class LinkRowFieldType implements FieldType {
  readonly type = 'link_row'
  readonly name = '關聯其他表'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined) return { valid: true, parsedValue: null }
    if (typeof value === 'string' || typeof value === 'number') return { valid: true, parsedValue: value }
    if (Array.isArray(value) && value.every(isLinkItem)) return { valid: true, parsedValue: value }
    return invalid()
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }
}
