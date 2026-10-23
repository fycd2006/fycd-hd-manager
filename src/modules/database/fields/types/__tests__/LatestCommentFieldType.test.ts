import { FieldRegistry } from '@/modules/database/fields/types'

const entry = { id: 'a', user: 'bob', time: '2026/01/01', content: 'hi' }
const v = (x: unknown) => FieldRegistry.get('latest_comment').validateValue(x, null)

describe('latest_comment', () => {
  it('is writable', () => expect(FieldRegistry.get('latest_comment').readOnly).toBe(false))
  it.each([null, undefined, ''])('%j -> []', (x) => expect(v(x)).toEqual({ valid: true, parsedValue: [] }))
  it('accepts an array of entries', () => expect(v([entry, { ...entry, id: 2 }])).toEqual({ valid: true, parsedValue: [entry, { ...entry, id: 2 }] }))
  it('accepts a JSON string of entries', () => expect(v(JSON.stringify([entry]))).toEqual({ valid: true, parsedValue: [entry] }))
  it.each<unknown>(['plain text', '{"a":1}', [{ id: 1 }], [{ ...entry, user: 5 }], [{ ...entry, content: undefined }], ['x'], 5, { ...entry }])(
    '%j -> invalid_format',
    (x) => expect(v(x)).toMatchObject({ valid: false, code: 'invalid_format' }),
  )
})
