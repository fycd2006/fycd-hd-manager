import { FieldRegistry } from '@/modules/database/fields/types'

const v = (type: string, input: unknown) => FieldRegistry.get(type).validateValue(input, null)
const ok = (parsedValue: unknown) => ({ valid: true, parsedValue })

describe('link_row', () => {
  it.each<unknown>([[[1, '2', { id: 3 }]], ['5'], [5]])('keeps %j unchanged', (input) => {
    expect(v('link_row', input)).toEqual(ok(input))
  })
  it.each<unknown>([{ foo: 1 }, [{}]])('%j -> invalid_format', (input) => {
    expect(v('link_row', input)).toMatchObject({ valid: false, code: 'invalid_format' })
  })
})

describe('collaborators', () => {
  it('normalizes to [{ id }]', () => {
    expect(v('collaborators', [1, { id: 2, username: 'x' }])).toEqual(ok([{ id: 1 }, { id: 2 }]))
    expect(v('collaborators', '[3]')).toEqual(ok([{ id: 3 }]))
  })
  it('empty array -> null', () => expect(v('collaborators', [])).toEqual(ok(null)))
  it.each<unknown>([[[0]], [['a']], [[1.5]]])('%j -> invalid_format', (input) => {
    expect(v('collaborators', input)).toMatchObject({ valid: false, code: 'invalid_format' })
  })
})

describe('attachment', () => {
  it('keeps valid attachments unchanged', () => {
    const input = [{ url: 'https://x/a.png', name: 'a' }]
    expect(v('attachment', input)).toEqual(ok(input))
  })
  it('rejects unsafe url', () => {
    expect(v('attachment', [{ url: 'javascript:x' }])).toMatchObject({ valid: false, code: 'invalid_url' })
  })
  it('rejects missing url', () => {
    expect(v('attachment', [{ name: 'no-url' }])).toMatchObject({ valid: false, code: 'invalid_format' })
  })
})
