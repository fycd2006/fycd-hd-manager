import type { DateFilterMode, FilterConjunction, FilterGroup, FilterItem, FilterOperator, FilterRule, TableField, TableRow } from '../types'
import { evaluateCellCondition, parseSelectItems } from '../components/views/grid/cells/utils'
import { cellDayInZone, resolveDateOptions, resolveTimeZone } from './dateTime'

const SET_OPERATORS: FilterOperator[] = ['is_any_of', 'is_none_of', 'has_any_of', 'has_all_of', 'has_none_of', 'is_exactly']
const DATE_OPERATORS: FilterOperator[] = ['date_equal', 'date_before', 'date_after', 'date_on_or_before', 'date_on_or_after', 'date_within']
const ID_FIELD_TYPES = ['link_row', 'collaborator']

export function isFilterGroup(item: FilterItem): item is FilterGroup {
  return (item as FilterGroup)?.type === 'group'
}

export function findFilterField(fields: TableField[], fieldKey: string): TableField | undefined {
  return fields.find(f => `field_${f.id}` === fieldKey || String(f.id) === fieldKey || f.name === fieldKey)
}

// Same lookup as page.tsx getCellValue: accepts field_1, 1 or "1"
export function readCellForFilter(row: TableRow, fieldKey: string): unknown {
  if (!row || !row.data) return ''
  const cleanId = String(fieldKey).replace('field_', '')
  const fk = `field_${cleanId}`
  if (fk in row.data) return row.data[fk] ?? ''
  if (cleanId in row.data) return row.data[cleanId] ?? ''
  return ''
}

// ---------- Date helpers (pure YYYY-MM-DD arithmetic in UTC) ----------

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
const toDay = (d: Date) => `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const splitDay = (day: string) => day.split('-').map(Number) as [number, number, number]

export function addDays(day: string, n: number): string {
  const [y, m, d] = splitDay(day)
  return toDay(new Date(Date.UTC(y, m - 1, d + n)))
}

// Month arithmetic clamped to the last day of the target month (3/31 − 1 month → 2/28)
export function addMonthsClamped(day: string, n: number): string {
  const [y, m, d] = splitDay(day)
  const lastDay = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  return toDay(new Date(Date.UTC(y, m - 1 + n, Math.min(d, lastDay))))
}

const NEEDS_AMOUNT: DateFilterMode[] = ['days_ago', 'days_from_now', 'past_n_days', 'next_n_days']
const hasAmount = (rule: FilterRule) => typeof rule.dateAmount === 'number' && Number.isFinite(rule.dateAmount) && rule.dateAmount >= 0

export function resolveDateTarget(rule: FilterRule, today: string): string | null {
  const mode = rule.dateMode || 'exact'
  if (NEEDS_AMOUNT.includes(mode) && !hasAmount(rule)) return null
  switch (mode) {
    case 'exact': {
      const v = (rule.value || '').trim()
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
    }
    case 'today': return today
    case 'tomorrow': return addDays(today, 1)
    case 'yesterday': return addDays(today, -1)
    case 'days_ago': return addDays(today, -rule.dateAmount!)
    case 'days_from_now': return addDays(today, rule.dateAmount!)
    default: return null
  }
}

export function resolveDateRange(rule: FilterRule, today: string): [string, string] | null {
  const mode = rule.dateMode || 'past_week'
  if (NEEDS_AMOUNT.includes(mode) && !hasAmount(rule)) return null
  switch (mode) {
    case 'past_week': return [addDays(today, -7), today]
    case 'next_week': return [today, addDays(today, 7)]
    case 'past_month': return [addMonthsClamped(today, -1), today]
    case 'next_month': return [today, addMonthsClamped(today, 1)]
    case 'past_year': return [addMonthsClamped(today, -12), today]
    case 'next_year': return [today, addMonthsClamped(today, 12)]
    case 'past_n_days': return [addDays(today, -rule.dateAmount!), today]
    case 'next_n_days': return [today, addDays(today, rule.dateAmount!)]
    default: return null
  }
}

function fieldTimeZone(field: TableField | undefined): string {
  return resolveTimeZone(resolveDateOptions(field?.options, field?.type))
}

function isRuleIncomplete(rule: FilterRule): boolean {
  if (SET_OPERATORS.includes(rule.operator)) return !Array.isArray(rule.values) || rule.values.length === 0
  if (rule.operator === 'date_within') return resolveDateRange(rule, '2000-01-01') === null
  if (DATE_OPERATORS.includes(rule.operator)) return resolveDateTarget(rule, '2000-01-01') === null
  return false
}

// New operators without a usable value (or on a deleted field) do not filter anything
function isRuleSkipped(rule: FilterRule, field: TableField | undefined): boolean {
  const isNew = SET_OPERATORS.includes(rule.operator) || DATE_OPERATORS.includes(rule.operator)
  if (!isNew) return false
  if (!field) return true
  return isRuleIncomplete(rule)
}

function evaluateDateOperator(val: unknown, field: TableField | undefined, rule: FilterRule, now: Date): boolean {
  const tz = fieldTimeZone(field)
  const cellDay = cellDayInZone(val, tz)
  if (!cellDay) return false
  const today = cellDayInZone(now.toISOString(), tz)
  if (!today) return false
  if (rule.operator === 'date_within') {
    const range = resolveDateRange(rule, today)
    return !!range && cellDay >= range[0] && cellDay <= range[1]
  }
  const target = resolveDateTarget(rule, today)
  if (!target) return false
  switch (rule.operator) {
    case 'date_equal': return cellDay === target
    case 'date_before': return cellDay < target
    case 'date_after': return cellDay > target
    case 'date_on_or_before': return cellDay <= target
    case 'date_on_or_after': return cellDay >= target
    default: return false
  }
}

function parseIdList(val: unknown): string[] {
  let list: unknown = val
  if (typeof val === 'string') {
    try { list = JSON.parse(val) } catch { list = val.split(',') }
  }
  if (!Array.isArray(list)) list = list === null || list === undefined || list === '' ? [] : [list]
  return (list as unknown[])
    .map(item => (item && typeof item === 'object' && 'id' in item ? (item as { id: unknown }).id : item))
    .map(id => String(id ?? '').trim())
    .filter(Boolean)
}

function cellTokens(val: unknown, field: TableField): string[] {
  if (ID_FIELD_TYPES.includes(field.type)) return parseIdList(val)
  return parseSelectItems(val, field.options).map(s => s.toLowerCase().trim())
}

function evaluateSetOperator(val: unknown, field: TableField, rule: FilterRule): boolean {
  const isIdField = ID_FIELD_TYPES.includes(field.type)
  const cell = new Set(cellTokens(val, field))
  const targets = (rule.values || []).map(v => (isIdField ? String(v).trim() : String(v).toLowerCase().trim()))
  const hits = targets.filter(t => cell.has(t))
  switch (rule.operator) {
    case 'is_any_of':
    case 'has_any_of':
      return hits.length > 0
    case 'is_none_of':
    case 'has_none_of':
      return hits.length === 0
    case 'has_all_of':
      return hits.length === targets.length
    case 'is_exactly':
      return new Set(targets).size === cell.size && targets.every(t => cell.has(t))
    default:
      return false
  }
}

export function evaluateFilterRule(value: unknown, field: TableField | undefined, rule: FilterRule, now: Date): boolean {
  if (isRuleSkipped(rule, field)) return true
  if (SET_OPERATORS.includes(rule.operator)) return evaluateSetOperator(value, field!, rule)
  if (DATE_OPERATORS.includes(rule.operator)) return evaluateDateOperator(value, field, rule, now)
  return evaluateCellCondition(value, field, rule.operator, rule.value)
}

type Outcome = boolean | null // null = skipped

function ruleOutcome(row: TableRow, rule: FilterRule, fields: TableField[], now: Date): Outcome {
  const field = findFilterField(fields, rule.fieldKey)
  if (isRuleSkipped(rule, field)) return null
  return evaluateFilterRule(readCellForFilter(row, rule.fieldKey), field, rule, now)
}

function combine(outcomes: Outcome[], conjunction: FilterConjunction): Outcome {
  const active = outcomes.filter((o): o is boolean => o !== null)
  if (active.length === 0) return null
  return conjunction === 'OR' ? active.some(Boolean) : active.every(Boolean)
}

export function evaluateFilters(
  row: TableRow,
  filterType: FilterConjunction,
  items: FilterItem[],
  fields: TableField[],
  now: Date = new Date()
): boolean {
  if (!Array.isArray(items) || items.length === 0) return true
  const outcomes = items.map(item => {
    if (isFilterGroup(item)) {
      const rules = Array.isArray(item.rules) ? item.rules : []
      return combine(rules.map(r => ruleOutcome(row, r, fields, now)), item.filterType === 'OR' ? 'OR' : 'AND')
    }
    return ruleOutcome(row, item, fields, now)
  })
  return combine(outcomes, filterType === 'OR' ? 'OR' : 'AND') ?? true
}
