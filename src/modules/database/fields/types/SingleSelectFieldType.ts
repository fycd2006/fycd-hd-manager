import { FieldType, FieldValidationResult } from '../FieldType'

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export class SingleSelectFieldType implements FieldType {
  readonly type = 'single_select'
  readonly name = '單選'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    
    const strVal = String(value)
    
    if (options && Array.isArray(options.choices)) {
      const choice = options.choices.find((c: any) => {
        if (typeof c === 'string') return c === strVal
        return c.name === strVal || c.id === strVal
      })
      if (choice) {
        return { valid: true, parsedValue: typeof choice === 'string' ? choice : choice.id }
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
