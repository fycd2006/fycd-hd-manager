import { evaluateFilterRule, evaluateFilters } from '../filterEvaluation'
import { evaluateCellCondition } from '../../components/views/grid/cells/utils'
import type { FilterItem, FilterRule, TableField, TableRow } from '../../types'

const NOW = new Date('2026-10-19T03:00:00Z')

const field = (id: number, type: string, options: unknown = null): TableField => ({
  id,
  tableId: 1,
  name: `f${id}`,
  type,
  order: id,
  options: options === null ? null : JSON.stringify(options),
})

const single = field(1, 'single_select', { select_options: [{ value: 'A' }, { value: 'B' }, { value: 'C' }] })
const multi = field(2, 'multiple_select', { select_options: [{ value: 'A' }, { value: 'B' }, { value: 'C' }] })
const link = field(3, 'link_row')
const collab = field(4, 'collaborator')
const text = field(5, 'text')

const rule = (operator: string, extra: Partial<FilterRule> = {}): FilterRule => ({
  fieldKey: 'field_0',
  operator: operator as FilterRule['operator'],
  value: '',
  ...extra,
})

describe('evaluateFilterRule — single select', () => {
  it.each([
    ['is_any_of', ['a', 'b'], 'A', true],
    ['is_any_of', ['a', 'b'], 'C', false],
    ['is_any_of', ['a', 'b'], '', false],
    ['is_none_of', ['a'], 'B', true],
    ['is_none_of', ['a'], 'A', false],
    ['is_none_of', ['a'], '', true],
  ])('%s %j on %j → %s', (op, values, cell, expected) => {
    expect(evaluateFilterRule(cell, single, rule(op, { values }), NOW)).toBe(expected)
  })
})

describe('evaluateFilterRule — multiple select', () => {
  it.each([
    ['has_any_of', ['B', 'X'], true],
    ['has_any_of', ['X'], false],
    ['has_all_of', ['A', 'B'], true],
    ['has_all_of', ['A', 'C'], false],
    ['has_none_of', ['C'], true],
    ['has_none_of', ['a'], false],
    ['is_exactly', ['B', 'A'], true],
    ['is_exactly', ['A'], false],
  ])('%s %j', (op, values, expected) => {
    expect(evaluateFilterRule('["A","B"]', multi, rule(op, { values }), NOW)).toBe(expected)
    expect(evaluateFilterRule(['A', 'B'], multi, rule(op, { values }), NOW)).toBe(expected)
  })
})

describe('evaluateFilterRule — link and collaborator match by id', () => {
  const linkVal = [{ id: 3, value: '甲' }, { id: 5, value: '乙' }]
  const collabVal = [{ id: 7, username: 'u' }]
  it.each([
    [link, linkVal, 'has_any_of', ['5'], true],
    [link, linkVal, 'has_all_of', ['3', '9'], false],
    [link, linkVal, 'has_all_of', ['3', '5'], true],
    [link, linkVal, 'is_exactly', ['5', '3'], true],
    [collab, collabVal, 'has_none_of', ['7'], false],
    [collab, collabVal, 'has_none_of', ['8'], true],
  ])('%#', (f, val, op, values, expected) => {
    expect(evaluateFilterRule(val, f, rule(op, { values }), NOW)).toBe(expected)
  })
})

describe('evaluateFilterRule — skipped rules', () => {
  it('new operator with empty values is skipped', () => {
    expect(evaluateFilterRule('C', single, rule('is_any_of', { values: [] }), NOW)).toBe(true)
  })
  it('new operator on a missing field is skipped', () => {
    expect(evaluateFilterRule('C', undefined, rule('has_any_of', { values: ['A'] }), NOW)).toBe(true)
  })
  it('legacy operator on a missing field keeps current behavior', () => {
    const r = rule('contains', { value: 'zz' })
    expect(evaluateFilterRule('abc', undefined, r, NOW)).toBe(evaluateCellCondition('abc', undefined, 'contains', 'zz'))
  })
})

describe('evaluateFilters — groups', () => {
  const fields = [text]
  const row = (v: string): TableRow => ({ id: 1, tableId: 1, order: 0, createdAt: '', data: { field_5: v } })
  const t = (value: string): FilterRule => ({ fieldKey: 'field_5', operator: 'contains', value })
  const yes = t('ab')
  const no = t('zz')
  const r = row('abc')

  it('AND with OR group', () => {
    const items: FilterItem[] = [yes, { type: 'group', filterType: 'OR', rules: [no, yes] }]
    expect(evaluateFilters(r, 'AND', items, fields, NOW)).toBe(true)
  })
  it('AND with AND group', () => {
    const items: FilterItem[] = [yes, { type: 'group', filterType: 'AND', rules: [no, yes] }]
    expect(evaluateFilters(r, 'AND', items, fields, NOW)).toBe(false)
  })
  it('empty group is skipped under OR', () => {
    const items: FilterItem[] = [no, { type: 'group', filterType: 'AND', rules: [] }]
    expect(evaluateFilters(r, 'OR', items, fields, NOW)).toBe(false)
  })
  it('no items → true', () => {
    expect(evaluateFilters(r, 'AND', [], fields, NOW)).toBe(true)
  })
  it('all skipped → true', () => {
    const skipped: FilterRule = { fieldKey: 'field_5', operator: 'has_any_of', value: '', values: [] }
    expect(evaluateFilters(r, 'OR', [skipped, { type: 'group', filterType: 'OR', rules: [skipped] }], fields, NOW)).toBe(true)
  })
  it('legacy rule list evaluates as before', () => {
    expect(evaluateFilters(r, 'AND', [{ fieldKey: 'field_5', operator: 'contains', value: 'ab' }], fields)).toBe(true)
    expect(evaluateFilters(row('xyz'), 'AND', [{ fieldKey: 'field_5', operator: 'contains', value: 'ab' }], fields)).toBe(false)
  })
})
