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

export class LatestCommentFieldType implements FieldType {
  readonly type = 'latest_comment'
  readonly name = '最新留言'

  validateValue(value: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: [] }
    }
    if (Array.isArray(value)) {
      return { valid: true, parsedValue: value }
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return { valid: true, parsedValue: parsed }
        }
      } catch {}
      return {
        valid: true,
        parsedValue: [
          {
            id: String(Date.now()),
            user: '系統 (System)',
            time: new Date().toLocaleString('zh-TW', { hour12: false }),
            content: trimmed,
          },
        ],
      }
    }
    return { valid: true, parsedValue: [] }
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
