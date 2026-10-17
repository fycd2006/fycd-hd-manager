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
  readonly readOnly = true

  validateValue(): FieldValidationResult {
    return { valid: false, code: 'read_only', error: '「最新留言」欄位為唯讀，請使用留言功能' }
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
