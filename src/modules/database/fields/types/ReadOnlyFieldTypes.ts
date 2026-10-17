import { FieldType, FieldValidationResult } from '../FieldType'

/** Computed or system-managed types: users can never write their cells. */
export const READ_ONLY_FIELD_TYPES = [
  'formula',
  'lookup',
  'rollup',
  'count',
  'autonumber',
  'uuid',
  'created_on',
  'created_by',
  'last_modified_on',
  'last_modified_by',
  'edit_row_link',
] as const

class ReadOnlyFieldType implements FieldType {
  readonly readOnly = true

  constructor(readonly type: string, readonly name: string) {}

  validateValue(): FieldValidationResult {
    return { valid: false, code: 'read_only', error: `「${this.name}」欄位為唯讀，不能直接寫入` }
  }

  formatValue(value: unknown): unknown {
    return value
  }

  getDefaultValue(): unknown {
    return null
  }
}

export const READ_ONLY_FIELD_TYPE_INSTANCES: FieldType[] = [
  new ReadOnlyFieldType('formula', '公式'),
  new ReadOnlyFieldType('lookup', '查閱'),
  new ReadOnlyFieldType('rollup', '彙總'),
  new ReadOnlyFieldType('count', '計數'),
  new ReadOnlyFieldType('autonumber', '自動編號'),
  new ReadOnlyFieldType('uuid', 'UUID'),
  new ReadOnlyFieldType('created_on', '建立時間'),
  new ReadOnlyFieldType('created_by', '建立者'),
  new ReadOnlyFieldType('last_modified_on', '最後修改時間'),
  new ReadOnlyFieldType('last_modified_by', '最後修改者'),
  new ReadOnlyFieldType('edit_row_link', '編輯列連結'),
]
