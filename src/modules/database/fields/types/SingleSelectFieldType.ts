import { FieldType, FieldValidationResult } from '../FieldType'

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export function extractChoices(options: any): any[] {
  if (!options) return []
  let opts = options
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts)
      if (typeof opts === 'string') opts = JSON.parse(opts)
    } catch {
      return []
    }
  }
  if (Array.isArray(opts)) return opts
  if (Array.isArray(opts?.choices)) return opts.choices
  if (Array.isArray(opts?.select_options)) return opts.select_options
  if (Array.isArray(opts?.options)) return opts.options
  return []
}

export class SingleSelectFieldType implements FieldType {
  readonly type = 'single_select'
  readonly name = '單選'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    
    const strVal = String(value)
    const choices = extractChoices(options)
    
    if (choices.length > 0) {
      const strTrimmed = strVal.trim()
      const strLower = strTrimmed.toLowerCase()
      const choice = choices.find((c: any) => {
        if (!c) return false
        if (typeof c === 'string') return c.trim() === strTrimmed || c.trim().toLowerCase() === strLower
        const cId = c.id != null ? String(c.id).trim() : ''
        const cName = c.name != null ? String(c.name).trim() : ''
        const cVal = c.value != null ? String(c.value).trim() : ''
        return (cId && (cId === strTrimmed || cId.toLowerCase() === strLower)) ||
               (cName && (cName === strTrimmed || cName.toLowerCase() === strLower)) ||
               (cVal && (cVal === strTrimmed || cVal.toLowerCase() === strLower))
      })
      if (choice) {
        return { valid: true, parsedValue: typeof choice === 'string' ? choice : (choice.id ?? choice.name) }
      }
      return { valid: true, parsedValue: strVal }
    }

    return { valid: true, parsedValue: strVal }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'VARCHAR(255)'
  }
}
