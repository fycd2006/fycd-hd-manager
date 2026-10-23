import { FieldType, FieldValidationResult } from '../FieldType'

const NUMBER_PATTERN = /^-?\d+(\.\d+)?(e-?\d+)?$/i

/** Parses user-typed numeric text. `null` means empty; `'invalid'` means unparseable. */
export function parseNumberText(raw: unknown): number | null | 'invalid' {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 'invalid'
  if (typeof raw !== 'string') return 'invalid'

  // Strip ONE leading currency symbol (a leading minus may precede it)
  const symbolRe = /^([-－]?)\s*(?:NT\$|[$¥￥€£])\s*/
  const trimmed = raw.trim()
  const hasSymbol = symbolRe.test(trimmed)
  const unsymbolled = trimmed.replace(symbolRe, '$1')
  if (hasSymbol && unsymbolled.replace(/[-－\s]/g, '') === '') return 'invalid'

  const text = unsymbolled
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .replace(/－/g, '-')
    .replace(/[,，\s]/g, '')
  if (text === '') return null
  if (!NUMBER_PATTERN.test(text)) return 'invalid'

  const num = Number(text)
  return Number.isFinite(num) ? num : 'invalid'
}

export class NumberFieldType implements FieldType {
  readonly type = 'number'
  readonly name = '數字'
  readonly readOnly = false

  validateValue(value: any, options: any): FieldValidationResult {
    const numVal = parseNumberText(value)
    if (numVal === 'invalid') {
      return { valid: false, code: 'invalid_number', error: '必須是有效的數字' }
    }
    if (numVal === null) {
      return { valid: true, parsedValue: null }
    }

    if (options) {
      if (options.min !== undefined && numVal < options.min) {
        return { valid: false, code: 'out_of_range', error: `不能小於 ${options.min}` }
      }
      if (options.max !== undefined && numVal > options.max) {
        return { valid: false, code: 'out_of_range', error: `不能大於 ${options.max}` }
      }
    }

    return { valid: true, parsedValue: numVal }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue ?? null
  }

  getGeneratedColumnSQLType(): string {
    return 'DECIMAL(20,6)'
  }
}
