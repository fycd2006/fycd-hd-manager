import { FieldRegistry } from '@/modules/database/fields/types'
import { READ_ONLY_FIELD_TYPES } from '../ReadOnlyFieldTypes'

describe.each([...READ_ONLY_FIELD_TYPES])('%s', (type) => {
  it('is registered, read-only and rejects every write', () => {
    expect(FieldRegistry.isRegistered(type)).toBe(true)
    const t = FieldRegistry.get(type)
    expect(t.readOnly).toBe(true)
    expect(t.validateValue('x', null)).toMatchObject({ valid: false, code: 'read_only' })
  })
  it('has the expected default value', () => {
    expect(FieldRegistry.get(type).getDefaultValue(null)).toBeNull()
  })
})
