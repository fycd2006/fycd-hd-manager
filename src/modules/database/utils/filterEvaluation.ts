import type { FilterConjunction, FilterGroup, FilterItem, FilterOperator, FilterRule, TableField, TableRow } from '../types'
import { evaluateCellCondition, parseSelectItems } from '../components/views/grid/cells/utils'

const SET_OPERATORS: FilterOperator[] = ['is_any_of', 'is_none_of', 'has_any_of', 'has_all_of', 'has_none_of', 'is_exactly']
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

function isNewOperator(op: FilterOperator): boolean {
  return SET_OPERATORS.includes(op)
}

// New operators without a usable value (or on a deleted field) do not filter anything
function isRuleSkipped(rule: FilterRule, field: TableField | undefined): boolean {
  if (!isNewOperator(rule.operator)) return false
  if (!field) return true
  return SET_OPERATORS.includes(rule.operator) && (!Array.isArray(rule.values) || rule.values.length === 0)
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
  void now
  if (isRuleSkipped(rule, field)) return true
  if (SET_OPERATORS.includes(rule.operator)) return evaluateSetOperator(value, field!, rule)
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
