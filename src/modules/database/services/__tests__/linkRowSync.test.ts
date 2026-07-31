import { parseLinkRowIds } from '../linkRowSync'

describe('parseLinkRowIds', () => {
  it('parses arrays of numeric IDs', () => {
    expect(parseLinkRowIds([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('parses arrays of object items with id property', () => {
    expect(parseLinkRowIds([{ id: 10, value: 'Item A' }, { id: 20, value: 'Item B' }])).toEqual([10, 20])
  })

  it('parses JSON string encoded arrays', () => {
    expect(parseLinkRowIds('[100, 200]')).toEqual([100, 200])
    expect(parseLinkRowIds('[{"id": 5}]')).toEqual([5])
  })

  it('parses comma-separated string IDs', () => {
    expect(parseLinkRowIds('1, 2, 3')).toEqual([1, 2, 3])
  })

  it('returns empty array for null, undefined, or empty string', () => {
    expect(parseLinkRowIds(null)).toEqual([])
    expect(parseLinkRowIds(undefined)).toEqual([])
    expect(parseLinkRowIds('')).toEqual([])
  })
})
