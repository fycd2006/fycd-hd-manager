import { parseNumberInput, formatNumberValue, evaluateCellCondition } from '../cells/utils'
import { computeFieldSummaries } from '../GridView'
import { TableField } from '@/modules/database/types'

describe('Number Field Operations and Utilities', () => {
  describe('parseNumberInput', () => {
    test('handles standard integers and decimals', () => {
      expect(parseNumberInput(123)).toBe(123)
      expect(parseNumberInput('123')).toBe(123)
      expect(parseNumberInput('0')).toBe(0)
      expect(parseNumberInput(0)).toBe(0)
      expect(parseNumberInput('12.345')).toBe(12.345)
      expect(parseNumberInput(-42)).toBe(-42)
      expect(parseNumberInput('-42.5')).toBe(-42.5)
    })

    test('parses formatted currency, thousands commas, and units', () => {
      expect(parseNumberInput('$1,234.56')).toBe(1234.56)
      expect(parseNumberInput('-$1,234.56')).toBe(-1234.56)
      expect(parseNumberInput('$-1,234.56')).toBe(-1234.56)
      expect(parseNumberInput('NT$ 9,999')).toBe(9999)
      expect(parseNumberInput('500元')).toBe(500)
      expect(parseNumberInput('¥ 8,888.88')).toBe(8888.88)
      expect(parseNumberInput('25%')).toBe(25)
    })

    test('handles null, undefined, empty, and invalid strings safely', () => {
      expect(parseNumberInput(null)).toBeNull()
      expect(parseNumberInput(undefined)).toBeNull()
      expect(parseNumberInput('')).toBeNull()
      expect(parseNumberInput('   ')).toBeNull()
      expect(parseNumberInput('abc')).toBeNull()
      expect(parseNumberInput('---')).toBeNull()
      expect(parseNumberInput(NaN)).toBeNull()
    })
  })

  describe('formatNumberValue', () => {
    test('formats positive numbers with thousands and prefix/suffix', () => {
      expect(formatNumberValue(1234567.89, {
        number_format: 'thousands',
        number_decimal_places: 2,
        number_prefix: '$',
        number_suffix: ' USD'
      })).toBe('$1,234,567.89 USD')
    })

    test('formats negative numbers with prefix placed correctly after minus sign', () => {
      expect(formatNumberValue(-150, {
        number_format: 'thousands',
        number_decimal_places: 0,
        number_prefix: '$'
      })).toBe('-$150')

      expect(formatNumberValue(-1234.5, {
        number_format: 'thousands',
        number_decimal_places: 1,
        number_prefix: 'NT$'
      })).toBe('-NT$1,234.5')
    })

    test('handles standard non-thousands format', () => {
      expect(formatNumberValue(12345, {
        number_format: 'standard',
        number_decimal_places: 0
      })).toBe('12345')
    })
  })

  describe('evaluateCellCondition for numeric fields', () => {
    const numberField = { id: 1, type: 'number', name: '金額' }

    test('evaluates numeric comparisons: higher_than and lower_than', () => {
      expect(evaluateCellCondition('100', numberField, 'higher_than', '50')).toBe(true)
      expect(evaluateCellCondition('100', numberField, 'higher_than', '150')).toBe(false)
      expect(evaluateCellCondition('50', numberField, 'lower_than', '100')).toBe(true)
      expect(evaluateCellCondition('100', numberField, 'lower_than_or_equal', '100')).toBe(true)
      expect(evaluateCellCondition('100', numberField, 'higher_than_or_equal', '100')).toBe(true)
    })

    test('evaluates numeric equivalence on equals and not_equals', () => {
      expect(evaluateCellCondition('10.0', numberField, 'equals', '10')).toBe(true)
      expect(evaluateCellCondition('$1,000', numberField, 'equals', '1000')).toBe(true)
      expect(evaluateCellCondition('10.0', numberField, 'not_equals', '10')).toBe(false)
      expect(evaluateCellCondition('15', numberField, 'not_equals', '10')).toBe(true)
    })

    test('evaluates empty and not_empty', () => {
      expect(evaluateCellCondition('', numberField, 'empty', '')).toBe(true)
      expect(evaluateCellCondition(null, numberField, 'empty', '')).toBe(true)
      expect(evaluateCellCondition(0, numberField, 'empty', '')).toBe(false)
      expect(evaluateCellCondition(0, numberField, 'not_empty', '')).toBe(true)
      expect(evaluateCellCondition(123, numberField, 'not_empty', '')).toBe(true)
    })
  })

  describe('computeFieldSummaries', () => {
    const mockFields: TableField[] = [
      { id: 1, tableId: 1, name: '數值', type: 'number', order: 0, options: null },
      { id: 2, tableId: 1, name: '評分', type: 'rating', order: 1, options: null }
    ]

    const mockRows = [
      { id: 101, values: { 1: 10, 2: 5 } },
      { id: 102, values: { 1: '$20', 2: 4 } },
      { id: 103, values: { 1: -5, 2: 3 } },
      { id: 104, values: { 1: null, 2: null } }
    ]

    test('calculates sum, avg, min, and max accurately', () => {
      const summaries = computeFieldSummaries(mockRows as any, mockFields)
      expect(summaries[1].sum).toBe(25) // 10 + 20 + (-5)
      expect(summaries[1].avg).toBe(8.3333) // 25 / 3
      expect(summaries[1].min).toBe(-5)
      expect(summaries[1].max).toBe(20)
      expect(summaries[1].count).toBe(3)
      expect(summaries[1].emptyCount).toBe(1)
    })
  })
})
