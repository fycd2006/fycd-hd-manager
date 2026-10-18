import { RatingFieldType } from '../RatingFieldType'

describe('RatingFieldType', () => {
  const type = new RatingFieldType()

  it.each<[unknown, unknown, unknown]>([
    [3, { max_value: 10 }, 3],
    ['4', undefined, 4],
    ['', undefined, null],
    [5, { max: 0 }, 5],
  ])('accepts %j with %j -> %j', (input, options, expected) => {
    expect(type.validateValue(input, options)).toEqual({ valid: true, parsedValue: expected })
  })

  it.each<[unknown, unknown]>([
    [9, { max: 5 }],
    [-3, undefined],
    [2.5, undefined],
  ])('rejects %j with %j as out_of_range', (input, options) => {
    expect(type.validateValue(input, options)).toMatchObject({ valid: false, code: 'out_of_range' })
  })

  it('rejects non-numeric as invalid_number', () => {
    expect(type.validateValue('abc', undefined)).toMatchObject({ valid: false, code: 'invalid_number' })
  })
})
