import { addDays, addMonthsClamped, evaluateFilterRule, evaluateFilters } from '../filterEvaluation'
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
  it.each(['date_on_or_before', 'date_on_or_after', 'date_within'])('new date operator %s on a missing field is skipped', (op) => {
    const r = rule(op, op === 'date_within' ? { dateMode: 'past_week' } : { dateMode: 'today' })
    expect(evaluateFilterRule('', undefined, r, NOW)).toBe(true)
  })
  it('legacy operator on a missing field keeps current behavior', () => {
    const r = rule('contains', { value: 'zz' })
    expect(evaluateFilterRule('abc', undefined, r, NOW)).toBe(evaluateCellCondition('abc', undefined, 'contains', 'zz'))
  })
})

describe('date helpers', () => {
  it.each([
    ['2026-03-31', -1, '2026-02-28'],
    ['2024-03-31', -1, '2024-02-29'],
    ['2026-10-19', 1, '2026-11-19'],
    ['2026-10-19', -12, '2025-10-19'],
  ])('addMonthsClamped(%s, %i) → %s', (day, n, expected) => {
    expect(addMonthsClamped(day, n)).toBe(expected)
  })
  it('addDays crosses year end', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('evaluateFilterRule — date modes (UTC field, today = 2026-10-19)', () => {
  const dateUtc = field(6, 'date', { date_time_zone: 'UTC' })
  it.each([
    ['date_equal', { dateMode: 'today' }, '2026-10-19', true],
    ['date_before', { dateMode: 'yesterday' }, '2026-10-17', true],
    ['date_before', { dateMode: 'yesterday' }, '2026-10-18', false],
    ['date_equal', { dateMode: 'tomorrow' }, '2026-10-20', true],
    ['date_on_or_before', { dateMode: 'days_ago', dateAmount: 2 }, '2026-10-17', true],
    ['date_on_or_before', { dateMode: 'days_ago', dateAmount: 2 }, '2026-10-18', false],
    ['date_on_or_after', { dateMode: 'days_from_now', dateAmount: 3 }, '2026-10-22', true],
    ['date_on_or_after', { dateMode: 'days_from_now', dateAmount: 3 }, '2026-10-21', false],
    ['date_after', { dateMode: 'exact', value: '2026-10-01' }, '2026-10-02', true],
    ['date_equal', { value: '2026-10-19' }, '2026-10-19', true],
    ['date_within', { dateMode: 'past_week' }, '2026-10-12', true],
    ['date_within', { dateMode: 'past_week' }, '2026-10-11', false],
    ['date_within', { dateMode: 'past_week' }, '2026-10-20', false],
    ['date_within', { dateMode: 'next_month' }, '2026-11-19', true],
    ['date_within', { dateMode: 'next_month' }, '2026-11-20', false],
    ['date_within', { dateMode: 'past_year' }, '2025-10-19', true],
    ['date_within', { dateMode: 'past_n_days', dateAmount: 3 }, '2026-10-16', true],
    ['date_within', { dateMode: 'past_n_days', dateAmount: 3 }, '2026-10-15', false],
    ['date_within', { dateMode: 'next_n_days', dateAmount: 0 }, '2026-10-19', true],
    ['date_within', { dateMode: 'next_n_days', dateAmount: 0 }, '2026-10-20', false],
  ])('%s %j on %s → %s', (op, extra, cell, expected) => {
    expect(evaluateFilterRule(cell, dateUtc, rule(op, extra as Partial<FilterRule>), NOW)).toBe(expected)
  })

  it('uses the field time zone for today', () => {
    const now = new Date('2026-10-18T17:00:00Z')
    const cell = '2026-10-18T15:00:00Z'
    const taipei = field(7, 'date', { date_include_time: true, date_time_zone: 'Asia/Taipei' })
    const utc = field(8, 'date', { date_include_time: true, date_time_zone: 'UTC' })
    expect(evaluateFilterRule(cell, taipei, rule('date_equal', { dateMode: 'yesterday' }), now)).toBe(true)
    expect(evaluateFilterRule(cell, taipei, rule('date_equal', { dateMode: 'today' }), now)).toBe(false)
    expect(evaluateFilterRule(cell, utc, rule('date_equal', { dateMode: 'today' }), now)).toBe(true)
  })

  it.each([
    ['days_ago without amount', rule('date_equal', { dateMode: 'days_ago' })],
    ['exact without value', rule('date_before', { dateMode: 'exact' })],
    ['past_n_days without amount', rule('date_within', { dateMode: 'past_n_days' })],
  ])('skips %s', (_label, r) => {
    expect(evaluateFilterRule('2026-01-01', dateUtc, r, NOW)).toBe(true)
  })

  it('empty cell never matches a date comparison', () => {
    expect(evaluateFilterRule('', dateUtc, rule('date_within', { dateMode: 'past_week' }), NOW)).toBe(false)
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
