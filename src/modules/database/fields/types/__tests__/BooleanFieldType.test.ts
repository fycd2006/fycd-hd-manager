import { BooleanFieldType, BOOLEAN_TRUE_WORDS, BOOLEAN_FALSE_WORDS } from '../BooleanFieldType'

describe('BooleanFieldType', () => {
  const type = new BooleanFieldType()

  it.each<unknown>([true, 'true', '1', 1, 'yes', 'Y', '是', 'v', '✓', '勾選'])('%j -> true', (input) => {
    expect(type.validateValue(input)).toEqual({ valid: true, parsedValue: true })
  })

  it.each<unknown>([false, 'false', '0', 0, 'no', 'n', '否', 'x', '✗', '', null])('%j -> false', (input) => {
    expect(type.validateValue(input)).toEqual({ valid: true, parsedValue: false })
  })

  it.each<unknown>(['abc', '2', 2])('%j -> invalid_boolean', (input) => {
    expect(type.validateValue(input)).toMatchObject({ valid: false, code: 'invalid_boolean' })
  })

  it('exports word lists', () => {
    expect(BOOLEAN_TRUE_WORDS).toContain('是')
    expect(BOOLEAN_FALSE_WORDS).toContain('否')
  })
})
