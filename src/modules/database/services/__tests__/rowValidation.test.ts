import { validateRowPatchPayload, FieldValidationMeta } from '../rowValidation'

const field = (id: number, type: string, name = `F${id}`): FieldValidationMeta => ({ id, name, type })

const expectValid = (val: unknown, type: string) => {
  const res = validateRowPatchPayload({ field_1: val }, [field(1, type)])
  expect(res.valid).toBe(true)
}

const expectInvalid = (val: unknown, type: string) => {
  const res = validateRowPatchPayload({ field_1: val }, [field(1, type)])
  expect(res.valid).toBe(false)
}

describe('validateRowPatchPayload', () => {
  it('skips null, undefined and empty-string values for any type', () => {
    const fields = [field(1, 'number'), field(2, 'boolean'), field(3, 'email')]
    const res = validateRowPatchPayload({ field_1: null, field_2: undefined, field_3: '' }, fields)
    expect(res.valid).toBe(true)
  })

  it('ignores keys without field_ prefix and keys for unknown fields', () => {
    const res = validateRowPatchPayload({ id: 'abc', field_99: 'not-a-number' }, [field(1, 'number')])
    expect(res.valid).toBe(true)
  })

  it('number: accepts numbers and numeric strings', () => {
    expectValid(42, 'number')
    expectValid(-3.5, 'number')
    expectValid('42', 'number')
  })

  it('number: rejects non-numeric and whitespace-only strings', () => {
    expectInvalid('abc', 'number')
    expectInvalid('   ', 'number')
    expectInvalid(true, 'number')
  })

  it.each(['rating', 'percent', 'currency', 'autonumber'])('%s: uses numeric validation', (type) => {
    expectValid('7', type)
    expectInvalid('seven', type)
  })

  it('boolean: accepts true/false/0/1 and string forms', () => {
    for (const v of [true, false, 0, 1, 'true', 'false']) expectValid(v, 'boolean')
  })

  it('boolean: rejects other values', () => {
    expectInvalid('yes', 'boolean')
    expectInvalid(2, 'boolean')
  })

  it('date: accepts Date objects and ISO strings', () => {
    expectValid(new Date('2026-01-01'), 'date')
    expectValid('2026-01-01T08:00:00Z', 'date')
  })

  it('date: rejects invalid date strings', () => {
    expectInvalid('不是日期', 'date')
  })

  it.each(['created_on', 'last_modified_on'])('%s: uses date validation', (type) => {
    expectValid('2026-01-01', type)
    expectInvalid('not-a-date', type)
  })

  it('email: accepts valid addresses with surrounding whitespace, rejects malformed', () => {
    expectValid('  user@example.com  ', 'email')
    expectInvalid('user@', 'email')
  })

  it('url: accepts http(s):// and www. prefixes, rejects others', () => {
    expectValid('https://example.com', 'url')
    expectValid('www.example.com', 'url')
    expectInvalid('example', 'url')
  })

  it('link_row: accepts id arrays, objects with id, strings and numbers', () => {
    expectValid([1, '2', { id: 3 }], 'link_row')
    expectValid('1,2', 'link_row')
    expectValid(5, 'link_row')
  })

  it('link_row: rejects objects without id and booleans', () => {
    expectInvalid([{ name: 'x' }], 'link_row')
    expectInvalid(true, 'link_row')
  })

  it('passes types without explicit rules (text, single_select) through unchanged', () => {
    expectValid({ any: 'thing' }, 'text')
    expectValid(123, 'single_select')
  })

  it('stops at the first error, names the field, and returns input unchanged when valid', () => {
    const fields = [field(1, 'number', '價格'), field(2, 'email', '信箱')]
    const bad = validateRowPatchPayload({ field_1: 'x', field_2: 'bad' }, fields)
    expect(bad).toEqual({ valid: false, error: expect.stringContaining('價格') })

    const input = { field_1: '10', field_2: 'a@b.co' }
    const ok = validateRowPatchPayload(input, fields)
    expect(ok).toEqual({ valid: true, parsedData: input })
    if (ok.valid) expect(ok.parsedData.field_1).toBe('10')
  })
})
