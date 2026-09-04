import { FieldType, FieldValidationResult } from '../FieldType'
import { extractChoices } from './SingleSelectFieldType'

export class MultipleSelectFieldType implements FieldType {
  readonly type = 'multiple_select'
  readonly name = '多選'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }

    let items: string[] = []
    
    // Parse the input value into an array of strings (which should be IDs now)
    if (Array.isArray(value)) {
      items = value.map(String)
    } else if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          items = parsed.map(String)
        } else {
          items = [value] // old comma-separated or single string fallback
        }
      } catch {
        items = value.split(',').map(s => s.trim()).filter(Boolean)
      }
    } else {
      items = [String(value)]
    }

    if (items.length === 0) {
      return { valid: true, parsedValue: null }
    }

    const choices = extractChoices(options)
    if (choices.length > 0) {
      const parsedItems: string[] = []
      
      for (const item of items) {
        const itemTrimmed = String(item).trim()
        const itemLower = itemTrimmed.toLowerCase()
        const choice = choices.find((c: any) => {
          if (!c) return false
          if (typeof c === 'string') return c.trim() === itemTrimmed || c.trim().toLowerCase() === itemLower
          const cId = c.id != null ? String(c.id).trim() : ''
          const cName = c.name != null ? String(c.name).trim() : ''
          const cVal = c.value != null ? String(c.value).trim() : ''
          return (cId && (cId === itemTrimmed || cId.toLowerCase() === itemLower)) ||
                 (cName && (cName === itemTrimmed || cName.toLowerCase() === itemLower)) ||
                 (cVal && (cVal === itemTrimmed || cVal.toLowerCase() === itemLower))
        })
        
        parsedItems.push(choice ? (typeof choice === 'string' ? choice : (choice.id ?? choice.name)) : itemTrimmed)
      }
      
      return { valid: true, parsedValue: JSON.stringify(parsedItems) }
    }

    return { valid: true, parsedValue: JSON.stringify(items) }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'JSON'
  }
}
