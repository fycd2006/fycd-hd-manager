import { FieldType, FieldValidationResult } from '../FieldType'

export interface CommentLogEntry {
  id: string
  user: string
  time: string
  content: string
}

export function parseLatestCommentEntries(val: any): CommentLogEntry[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed
    } catch {}
  }
  return []
}

const invalidComment = (): FieldValidationResult => ({
  valid: false,
  code: 'invalid_format',
  error: '留言格式不正確，每則留言都必須包含 id、user、time 與 content',
})

function isCommentEntry(item: unknown): boolean {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) return false
  const e = item as Record<string, unknown>
  return (
    (typeof e.id === 'string' || typeof e.id === 'number') &&
    typeof e.user === 'string' &&
    typeof e.time === 'string' &&
    typeof e.content === 'string'
  )
}

export class LatestCommentFieldType implements FieldType {
  readonly type = 'latest_comment'
  readonly name = '最新留言'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: [] }
    }
    let list: unknown = value
    if (typeof value === 'string') {
      try {
        list = JSON.parse(value)
      } catch {
        return invalidComment()
      }
    }
    if (!Array.isArray(list) || !list.every(isCommentEntry)) return invalidComment()
    return { valid: true, parsedValue: list }
  }

  formatValue(value: any): any {
    return value
  }

  getDefaultValue(): any {
    return []
  }

  getGeneratedColumnSQLType(): string {
    return 'JSON'
  }
}
