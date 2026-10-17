export type RejectCode =
  | 'read_only'
  | 'unknown_type'
  | 'unknown_option'
  | 'invalid_number'
  | 'out_of_range'
  | 'invalid_boolean'
  | 'invalid_date'
  | 'invalid_email'
  | 'invalid_url'
  | 'invalid_phone'
  | 'invalid_duration'
  | 'invalid_format'

export type FieldValidationResult =
  | { valid: true; parsedValue: unknown }
  | { valid: false; code: RejectCode; error: string }

export interface FieldType<T = any> {
  /** The unique string identifier for the field type (e.g. 'text', 'number', 'date') */
  readonly type: string
  
  /** The human-readable name of the field type */
  readonly name: string

  /** Whether cells of this type cannot be written by users (computed / system-managed) */
  readonly readOnly: boolean

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
