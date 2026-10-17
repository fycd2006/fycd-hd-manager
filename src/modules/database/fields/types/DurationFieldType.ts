import { FieldType, FieldValidationResult } from '../FieldType'

const invalid = (): FieldValidationResult => ({
  valid: false,
  code: 'invalid_duration',
  error: '時間長度格式不正確，請輸入 h:mm、h:mm:ss 或分鐘數',
})

export class DurationFieldType implements FieldType {
  readonly type = 'duration'
  readonly name = '時間長度'
  readonly readOnly = false

  validateValue(value: unknown): FieldValidationResult {
    if (value === null || value === undefined) return { valid: true, parsedValue: null }
    const str = String(value).trim()
    if (str === '') return { valid: true, parsedValue: null }

    if (/^\d+$/.test(str)) {
      const minutes = Number(str)
      return { valid: true, parsedValue: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}` }
    }

    const m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(str)
    if (!m) return invalid()
    const mins = Number(m[2])
    const secs = m[3] === undefined ? 0 : Number(m[3])
    if (mins >= 60 || secs >= 60) return invalid()
    return { valid: true, parsedValue: str }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(32)'
  }
}
