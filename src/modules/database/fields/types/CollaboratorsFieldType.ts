import { FieldType, FieldValidationResult } from '../FieldType'

const invalid = (): FieldValidationResult => ({
  valid: false,
  code: 'invalid_format',
  error: '協作者格式不正確，必須是使用者 ID 的陣列',
})

function toUserId(item: unknown): number | null {
  const raw = typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : item
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null
}

export class CollaboratorsFieldType implements FieldType {
  readonly type = 'collaborators'
  readonly name = '協作者'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined || value === '') return { valid: true, parsedValue: null }

    let list: unknown = value
    if (typeof value === 'string') {
      try {
        list = JSON.parse(value)
      } catch {
        return invalid()
      }
    }
    if (!Array.isArray(list)) return invalid()

    const ids: { id: number }[] = []
    for (const item of list) {
      const id = toUserId(item)
      if (id === null) return invalid()
      ids.push({ id })
    }
    return { valid: true, parsedValue: ids.length === 0 ? null : ids }
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
