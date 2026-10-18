import { FieldType, FieldValidationResult } from './FieldType'

/** Fail-closed placeholder for types that are not registered: every write is rejected. */
class UnknownFieldType implements FieldType {
  readonly type = 'unknown'
  readonly name = '未知'
  readonly readOnly = true

  constructor(readonly requestedType: string) {}

  validateValue(): FieldValidationResult {
    return { valid: false, code: 'unknown_type', error: `不支援的欄位型別「${this.requestedType}」` }
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
  private aliases: Map<string, string> = new Map()
  private fallbacks: Map<string, FieldType> = new Map()

  public register(fieldType: FieldType, ...aliases: string[]) {
    if (this.types.has(fieldType.type)) {
      console.warn(`[FieldRegistry] FieldType '${fieldType.type}' is already registered and will be overwritten.`)
    }
    this.types.set(fieldType.type, fieldType)
    for (const alias of aliases) this.aliases.set(alias, fieldType.type)
  }

  /** Declare an alias independently of the implementation, so it works once the canonical type is registered. */
  public registerAlias(alias: string, canonical: string) {
    this.aliases.set(alias, canonical)
  }

  public isRegistered(type: string): boolean {
    return this.types.has(this.aliases.get(type) ?? type)
  }

  public get(type: string): FieldType {
    const canonical = this.aliases.get(type) ?? type
    const found = this.types.get(canonical)
    if (found) return found
    let fallback = this.fallbacks.get(canonical)
    if (!fallback) {
      fallback = new UnknownFieldType(canonical)
      this.fallbacks.set(canonical, fallback)
    }
    return fallback
  }

  public getAll(): FieldType[] {
    return Array.from(this.types.values())
  }
}

export const FieldRegistry = new Registry()
