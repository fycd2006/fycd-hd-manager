import { FieldRegistry } from '@/modules/database/fields/types'

const v = (type: string, input: unknown) => FieldRegistry.get(type).validateValue(input, null)

describe.each(['text', 'long_text', 'password', 'ai_prompt'])('%s', (type) => {
  it('trims, empties to null, stringifies', () => {
    expect(v(type, '  abc ')).toEqual({ valid: true, parsedValue: 'abc' })
    expect(v(type, '   ')).toEqual({ valid: true, parsedValue: null })
    expect(v(type, 123)).toEqual({ valid: true, parsedValue: '123' })
    expect(v(type, true)).toEqual({ valid: true, parsedValue: 'true' })
  })
  it.each<unknown>([{ a: 1 }, ['x'], []])('%j -> invalid_format', (input) => {
    expect(v(type, input)).toMatchObject({ valid: false, code: 'invalid_format', error: '必須是文字' })
  })
})

describe('email', () => {
  it('normalizes', () => expect(v('email', 'Bob@Example.COM ')).toEqual({ valid: true, parsedValue: 'bob@example.com' }))
  it.each(['not-an-email', 'a@b'])('%s -> invalid_email', (x) => {
    expect(v('email', x)).toMatchObject({ valid: false, code: 'invalid_email' })
  })
})

describe('url', () => {
  it('adds https', () => expect(v('url', 'example.com/x')).toEqual({ valid: true, parsedValue: 'https://example.com/x' }))
  it('adds https to www.', () => expect(v('url', 'www.example.com')).toEqual({ valid: true, parsedValue: 'https://www.example.com' }))
  it('accepts a bare host (current behavior)', () => expect(v('url', 'example')).toEqual({ valid: true, parsedValue: 'https://example' }))
  it('keeps http', () => expect(v('url', 'http://a.tw')).toEqual({ valid: true, parsedValue: 'http://a.tw' }))
  it.each(['javascript:alert(1)', 'ftp://a'])('%s -> invalid_url', (x) => {
    expect(v('url', x)).toMatchObject({ valid: false, code: 'invalid_url' })
  })
})

describe('phone_number', () => {
  it('accepts', () => {
    expect(v('phone_number', ' +886 (2) 1234-5678 ')).toEqual({ valid: true, parsedValue: '+886 (2) 1234-5678' })
  })
  it.each(['12345', 'abc'])('%s -> invalid_phone', (x) => {
    expect(v('phone_number', x)).toMatchObject({ valid: false, code: 'invalid_phone' })
  })
})

describe('duration', () => {
  it.each([['1:30', '1:30'], ['1:05:09', '1:05:09'], ['90', '1:30']])('%s -> %s', (i, o) => {
    expect(v('duration', i)).toEqual({ valid: true, parsedValue: o })
  })
  it.each(['0:75', 'banana', '-5'])('%s -> invalid_duration', (x) => {
    expect(v('duration', x)).toMatchObject({ valid: false, code: 'invalid_duration' })
  })
})
