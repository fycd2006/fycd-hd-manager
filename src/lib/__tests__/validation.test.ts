import { sanitizeSearchQuery, parsePositiveInt } from '../validation'

describe('sanitizeSearchQuery', () => {
  it('returns empty string for non-string inputs', () => {
    expect(sanitizeSearchQuery(null)).toBe('')
    expect(sanitizeSearchQuery(undefined)).toBe('')
    expect(sanitizeSearchQuery(123)).toBe('')
    expect(sanitizeSearchQuery({})).toBe('')
  })

  it('trims whitespace and enforces maxLength', () => {
    expect(sanitizeSearchQuery('  hello world  ')).toBe('hello world')
    expect(sanitizeSearchQuery('abcdefghij', 5)).toBe('abcde')
  })

  it('strips dangerous HTML characters < > " \'', () => {
    expect(sanitizeSearchQuery('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script')
    expect(sanitizeSearchQuery("SELECT * FROM 'users'")).toBe('SELECT * FROM users')
  })
})

describe('parsePositiveInt', () => {
  it('parses valid positive integer numbers and strings', () => {
    expect(parsePositiveInt(10)).toBe(10)
    expect(parsePositiveInt('42')).toBe(42)
    expect(parsePositiveInt(0)).toBe(0)
  })

  it('returns defaultValue for invalid, negative, or non-integer inputs', () => {
    expect(parsePositiveInt(-5, 0)).toBe(0)
    expect(parsePositiveInt('abc', 10)).toBe(10)
    expect(parsePositiveInt(3.14, 0)).toBe(0)
    expect(parsePositiveInt(null, 1)).toBe(1)
    expect(parsePositiveInt(undefined, 5)).toBe(5)
  })
})
