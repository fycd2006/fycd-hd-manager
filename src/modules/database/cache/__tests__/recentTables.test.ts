/** @jest-environment jsdom */
import { getRecentTables, pushRecentTable } from '../recentTables'

beforeEach(() => localStorage.clear())
afterEach(() => jest.restoreAllMocks())

describe('recentTables', () => {
  it('push moves to front and dedupes', () => {
    pushRecentTable(1, 1)
    pushRecentTable(1, 2)
    pushRecentTable(1, 1)
    expect(getRecentTables(1)).toEqual([1, 2])
  })

  it('caps at 5', () => {
    for (let i = 1; i <= 6; i++) pushRecentTable(1, i)
    expect(getRecentTables(1)).toEqual([6, 5, 4, 3, 2])
  })

  it('stores under recentTables_<workspaceId>', () => {
    pushRecentTable(1, 7)
    expect(localStorage.getItem('recentTables_1')).toBe('[7]')
  })

  it('scoped by workspace', () => {
    pushRecentTable(1, 10)
    pushRecentTable(2, 20)
    expect(getRecentTables(1)).toEqual([10])
    expect(getRecentTables(2)).toEqual([20])
  })

  it('returns [] when storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(getRecentTables(1)).toEqual([])
  })

  it('push does not throw when setItem throws', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => pushRecentTable(1, 1)).not.toThrow()
  })

  it('returns [] on malformed JSON', () => {
    localStorage.setItem('recentTables_1', '{not json')
    expect(getRecentTables(1)).toEqual([])
  })
})
