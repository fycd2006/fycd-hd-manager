import { Prisma } from '@prisma/client'

export interface FieldValidationResult {
  valid: boolean
  error?: string
  parsedValue?: any
}

export interface FieldType<T = any> {
  /** The unique string identifier for the field type (e.g. 'text', 'number', 'date') */
  readonly type: string
  
  /** The human-readable name of the field type */
  readonly name: string

  /** 
   * Validates and parses the raw input value based on the field options.
   * Should return the transformed value to be stored in the DB, or an error.
   */
  validateValue(value: any, options: any): FieldValidationResult

  /** 
   * Formats the stored database value for client consumption, if needed.
   */
  formatValue(value: any, options: any): any
  
  /**
   * Generates a default value for the field if no value is provided.
   */
  getDefaultValue(options: any): any

  // TiDB Generated Column support
  getGeneratedColumnSQLType?(): string
  getGeneratedColumnSQLExpression?(fieldKey: string): string
}
