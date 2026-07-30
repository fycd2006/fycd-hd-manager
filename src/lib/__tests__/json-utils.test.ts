import { safeJsonParse } from '../json-utils'

describe('safeJsonParse', () => {
  it('should parse valid JSON strings correctly', () => {
    const input = JSON.stringify({ key: 'value', num: 42 })
    const result = safeJsonParse(input, {})
    expect(result).toEqual({ key: 'value', num: 42 })
  })

  it('should return fallback for null or undefined input', () => {
    expect(safeJsonParse(null, { default: true })).toEqual({ default: true })
    expect(safeJsonParse(undefined, 'fallback')).toBe('fallback')
  })

  it('should return fallback for invalid JSON strings without throwing', () => {
    const invalidJson = '{ key: "value" incomplete'
    const fallback: any[] = []
    expect(safeJsonParse(invalidJson, fallback)).toBe(fallback)
  })
})
