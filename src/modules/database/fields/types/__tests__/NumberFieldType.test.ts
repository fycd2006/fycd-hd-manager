import { NumberFieldType, parseNumberText } from '../NumberFieldType'

describe('NumberFieldType', () => {
  const type = new NumberFieldType()

  it.each<[unknown, unknown, unknown]>([
    [' ', undefined, null],
    ['1,000', undefined, 1000],
    ['-1,234.5', undefined, -1234.5],
    ['１２３', undefined, 123],
    ['1e3', undefined, 1000],
    [42, undefined, 42],
  ])('parses %j with %j -> %j', (input, options, expected) => {
    expect(type.validateValue(input, options)).toEqual({ valid: true, parsedValue: expected })
  })

  it.each(['Infinity', 'NaN', '0x10', '1e3x', 'abc'])('rejects %j as invalid_number', (input) => {
    const res = type.validateValue(input, undefined)
    expect(res).toMatchObject({ valid: false, code: 'invalid_number' })
  })

  it('rejects non-finite number input', () => {
    expect(type.validateValue(Infinity, undefined)).toMatchObject({ valid: false, code: 'invalid_number' })
  })

  it.each<[unknown, { min?: number; max?: number }]>([
    [5, { max: 3 }],
    [-1, { min: 0 }],
  ])('rejects %j with %j as out_of_range', (input, options) => {
    expect(type.validateValue(input, options)).toMatchObject({ valid: false, code: 'out_of_range' })
  })
})

describe('parseNumberText', () => {
  it('returns null for empty and invalid for junk', () => {
    expect(parseNumberText(null)).toBeNull()
    expect(parseNumberText('')).toBeNull()
    expect(parseNumberText('x')).toBe('invalid')
  })
})
