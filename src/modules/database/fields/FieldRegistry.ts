import { FieldType, FieldValidationResult } from './FieldType'

class UnknownFieldType implements FieldType {
  readonly type = 'unknown'
  readonly name = '未知'

  validateValue(value: any): FieldValidationResult {
    return { valid: true, parsedValue: value }
  }

  formatValue(value: any): any {
    return value
  }

  getDefaultValue(): any {
    return null
  }
}

class Registry {
  private types: Map<string, FieldType> = new Map()
  private fallbackType = new UnknownFieldType()

  public register(fieldType: FieldType) {
    if (this.types.has(fieldType.type)) {
      console.warn(`[FieldRegistry] FieldType '${fieldType.type}' is already registered and will be overwritten.`)
    }
    this.types.set(fieldType.type, fieldType)
  }

  public get(type: string): FieldType {
    return this.types.get(type) || this.fallbackType
  }

  public getAll(): FieldType[] {
    return Array.from(this.types.values())
  }
}

export const FieldRegistry = new Registry()
