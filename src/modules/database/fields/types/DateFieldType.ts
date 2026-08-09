import { FieldType, FieldValidationResult } from '../FieldType'

export class DateFieldType implements FieldType {
  readonly type = 'date'
  readonly name = '日期'

  validateValue(value: any, options: any): FieldValidationResult {
    if (value === null || value === undefined || value === '') {
      return { valid: true, parsedValue: null }
    }
    
    const date = new Date(value)
    if (isNaN(date.getTime())) {
      return { valid: false, error: '必須是有效的日期格式 (ISO 8601)' }
    }

    return { valid: true, parsedValue: date.toISOString() }
  }

  formatValue(value: any, options: any): any {
    return value
  }

  getDefaultValue(options: any): any {
    if (options?.defaultValue === 'NOW') {
      return new Date().toISOString()
    }
    return options?.defaultValue || null
  }

  getGeneratedColumnSQLType(): string {
    return 'DATETIME'
  }
  
  getGeneratedColumnSQLExpression(fieldKey: string): string {
    // TiDB cast string to datetime from JSON
    return `CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$."${fieldKey}"')) AS DATETIME)`
  }
}
