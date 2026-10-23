import { getFilterOperators } from '../fieldTypes'
import zhTW from '@/lib/i18n/locales/zh-TW.json'
import en from '@/lib/i18n/locales/en.json'

const TEXT = ['contains', 'not_contains', 'equals', 'not_equals', 'empty', 'not_empty']
const NUMBER = ['equals', 'not_equals', 'higher_than', 'higher_than_or_equal', 'lower_than', 'lower_than_or_equal', 'empty', 'not_empty']
const SINGLE = ['equals', 'not_equals', 'is_any_of', 'is_none_of', 'empty', 'not_empty']
const MULTI = ['has_any_of', 'has_all_of', 'has_none_of', 'is_exactly', 'empty', 'not_empty']
const LINK = ['contains', 'has_any_of', 'has_all_of', 'has_none_of', 'empty', 'not_empty']
const DATE = ['date_equal', 'date_before', 'date_after', 'date_on_or_before', 'date_on_or_after', 'date_within', 'empty', 'not_empty']

describe('getFilterOperators', () => {
  it.each([
    ['text', TEXT],
    ['long_text', TEXT],
    [undefined, TEXT],
    ['something_unknown', TEXT],
    ['number', NUMBER],
    ['rating', NUMBER],
    ['autonumber', NUMBER],
    ['percent', NUMBER],
    ['currency', NUMBER],
    ['single_select', SINGLE],
    ['multiple_select', MULTI],
    ['link_row', LINK],
    ['collaborator', LINK],
    ['date', DATE],
    ['created_on', DATE],
    ['last_modified_on', DATE],
    ['boolean', ['equals']],
  ])('%s', (type, expected) => {
    expect(getFilterOperators(type).map(o => o.value)).toEqual(expected)
  })

  it('every label key exists in zh-TW and en', () => {
    const types = ['text', 'number', 'single_select', 'multiple_select', 'link_row', 'date', 'boolean']
    const keys = new Set(types.flatMap(t => getFilterOperators(t).map(o => o.labelKey)))
    const lookup = (dict: Record<string, unknown>, key: string) =>
      key.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict)
    keys.forEach(key => {
      expect(typeof lookup(zhTW, key)).toBe('string')
      expect(typeof lookup(en, key)).toBe('string')
    })
  })
})
