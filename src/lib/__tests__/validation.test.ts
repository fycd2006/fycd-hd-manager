import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeSearchQuery, parsePositiveInt } from '../validation'

describe('sanitizeSearchQuery', () => {
  it('returns empty string for non-string inputs', () => {
    assert.equal(sanitizeSearchQuery(null), '')
    assert.equal(sanitizeSearchQuery(undefined), '')
    assert.equal(sanitizeSearchQuery(123), '')
    assert.equal(sanitizeSearchQuery({}), '')
  })

  it('trims whitespace and enforces maxLength', () => {
    assert.equal(sanitizeSearchQuery('  hello world  '), 'hello world')
    assert.equal(sanitizeSearchQuery('abcdefghij', 5), 'abcde')
  })

  it('strips dangerous HTML characters < > " \'', () => {
    assert.equal(sanitizeSearchQuery('<script>alert("xss")</script>'), 'scriptalert(xss)/script')
    assert.equal(sanitizeSearchQuery("SELECT * FROM 'users'"), 'SELECT * FROM users')
  })
})

describe('parsePositiveInt', () => {
  it('parses valid positive integer numbers and strings', () => {
    assert.equal(parsePositiveInt(10), 10)
    assert.equal(parsePositiveInt('42'), 42)
    assert.equal(parsePositiveInt(0), 0)
  })

  it('returns defaultValue for invalid, negative, or non-integer inputs', () => {
    assert.equal(parsePositiveInt(-5, 0), 0)
    assert.equal(parsePositiveInt('abc', 10), 10)
    assert.equal(parsePositiveInt(3.14, 0), 0)
    assert.equal(parsePositiveInt(null, 1), 1)
    assert.equal(parsePositiveInt(undefined, 5), 5)
  })
})
