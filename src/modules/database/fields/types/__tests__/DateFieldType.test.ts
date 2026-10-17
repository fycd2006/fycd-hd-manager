import { DateFieldType } from '../DateFieldType'

describe('DateFieldType', () => {
  const type = new DateFieldType()

  it.each<[unknown, unknown]>([
    ['2026-10-17', '2026-10-17'],
    ['2026/10/17', '2026-10-17'],
    ['2026/1/5', '2026-01-05'],
    ['2026-10-16T16:00:00.000Z', '2026-10-16'],
    ['', null],
  ])('%j -> %j', (input, expected) => {
    expect(type.validateValue(input, undefined)).toEqual({ valid: true, parsedValue: expected })
  })

  it.each<unknown>(['1', 0, '10/17/2026', '2026-02-30', 'abc'])('%j -> invalid_date', (input) => {
    expect(type.validateValue(input, undefined)).toMatchObject({ valid: false, code: 'invalid_date' })
  })

  it('NOW default is local YYYY-MM-DD', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 23, 30))
    try {
      expect(type.getDefaultValue({ defaultValue: 'NOW' })).toBe('2026-10-17')
    } finally {
      jest.useRealTimers()
    }
  })

  it('uses DATE generated column', () => {
    expect(type.getGeneratedColumnSQLType()).toBe('DATE')
    expect(type.getGeneratedColumnSQLExpression('field_1')).toBe(
      `CAST(LEFT(JSON_UNQUOTE(JSON_EXTRACT(data, '$."field_1"')), 10) AS DATE)`
    )
  })
})
