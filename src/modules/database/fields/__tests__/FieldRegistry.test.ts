import { FieldRegistry } from '@/modules/database/fields/types'

it('rejects writes to unregistered types instead of passing them through', () => {
  const t = FieldRegistry.get('no_such_type')
  expect(t.readOnly).toBe(true)
  expect(t.validateValue('x', null)).toEqual({ valid: false, code: 'unknown_type', error: expect.any(String) })
})

it('reports registration state', () => {
  expect(FieldRegistry.isRegistered('text')).toBe(true)
  expect(FieldRegistry.isRegistered('no_such_type')).toBe(false)
})

it.each([
  ['phone', 'phone_number'],
  ['collaborator', 'collaborators'],
  ['file', 'attachment'],
])('alias %s resolves to %s', (alias, canonical) => {
  expect(FieldRegistry.isRegistered(canonical)).toBe(true)
  expect(FieldRegistry.get(alias).readOnly).toBe(false)
  expect(FieldRegistry.get(alias)).toBe(FieldRegistry.get(canonical))
})

it.each(['number', 'rating', 'text'])('%s keeps a falsy default value of 0', (type) => {
  expect(FieldRegistry.get(type).getDefaultValue({ defaultValue: 0 })).toBe(0)
})
