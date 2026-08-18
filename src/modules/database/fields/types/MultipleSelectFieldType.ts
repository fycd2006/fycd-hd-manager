import { FieldType, FieldValidationResult } from '../FieldType'

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

    if (options && Array.isArray(options.choices)) {
      const parsedItems: string[] = []
      
      for (const item of items) {
        const choice = options.choices.find((c: any) => {
          if (typeof c === 'string') return c === item
          return c.id === item || c.name === item
        })
        
        parsedItems.push(choice ? (typeof choice === 'string' ? choice : choice.id) : item)
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
