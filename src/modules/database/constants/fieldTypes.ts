/**
 * Database Module - Field Type Configuration
 * Icons and labels for different field types
 */

import React from 'react'
import { 
  Type, AlignLeft, ArrowLeftRight, Hash, Star, CheckSquare, CheckCircle, Calendar, History, UserCheck, 
  CalendarPlus, UserPlus, Clock, Link2, Mail, ListFilter, Phone, Calculator, 
  Sigma, Layers, Search, Users, Fingerprint, ListOrdered, Lock, ExternalLink, Sparkles, MessageSquare 
} from 'lucide-react'
import type { DateFilterMode, FilterOperator } from '../types'

/**
 * Map all 27 field types to clean, modern, high-end Lucide icons matching Baserow standards
 */
export const FIELD_TYPE_ICONS: Record<string, () => React.ReactNode> = {
  text: () => React.createElement(Type, { size: 14 }),
  long_text: () => React.createElement(AlignLeft, { size: 14 }),
  link_row: () => React.createElement(ArrowLeftRight, { size: 14 }),
  number: () => React.createElement(Hash, { size: 14 }),
  rating: () => React.createElement(Star, { size: 14 }),
  boolean: () => React.createElement(CheckSquare, { size: 14 }),
  date: () => React.createElement(Calendar, { size: 14 }),
  last_modified_on: () => React.createElement(History, { size: 14 }),
  last_modified_by: () => React.createElement(UserCheck, { size: 14 }),
  created_on: () => React.createElement(CalendarPlus, { size: 14 }),
  created_by: () => React.createElement(UserPlus, { size: 14 }),
  duration: () => React.createElement(Clock, { size: 14 }),
  url: () => React.createElement(Link2, { size: 14 }),
  email: () => React.createElement(Mail, { size: 14 }),
  single_select: () => React.createElement(CheckCircle, { size: 14 }),
  multiple_select: () => React.createElement(ListFilter, { size: 14 }),
  phone: () => React.createElement(Phone, { size: 14 }),
  phone_number: () => React.createElement(Phone, { size: 14 }),
  formula: () => React.createElement(Calculator, { size: 14 }),
  count: () => React.createElement(Sigma, { size: 14 }),
  rollup: () => React.createElement(Layers, { size: 14 }),
  lookup: () => React.createElement(Search, { size: 14 }),
  collaborator: () => React.createElement(Users, { size: 14 }),
  collaborators: () => React.createElement(Users, { size: 14 }),
  uuid: () => React.createElement(Fingerprint, { size: 14 }),
  autonumber: () => React.createElement(ListOrdered, { size: 14 }),
  password: () => React.createElement(Lock, { size: 14 }),
  edit_row_link: () => React.createElement(ExternalLink, { size: 14 }),
  ai_prompt: () => React.createElement(Sparkles, { size: 14 }),
  latest_comment: () => React.createElement(MessageSquare, { size: 14 }),
}

/**
 * Map field types to human-readable labels
 */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Single line text',
  long_text: 'Long text',
  link_row: 'Link to table',
  number: 'Number',
  rating: 'Rating',
  boolean: 'Boolean',
  date: 'Date',
  last_modified_on: 'Last modified',
  last_modified_by: 'Last modified by',
  created_on: 'Created on',
  created_by: 'Created by',
  duration: 'Duration',
  url: 'URL',
  email: 'Email',
  single_select: 'Single select',
  multiple_select: 'Multiple select',
  phone: 'Phone number',
  phone_number: 'Phone number',
  formula: 'Formula',
  count: 'Count',
  rollup: 'Rollup',
  lookup: 'Lookup',
  collaborator: 'Collaborators',
  collaborators: 'Collaborators',
  uuid: 'UUID',
  autonumber: 'Autonumber',
  password: 'Password',
  edit_row_link: 'Edit row link',
  ai_prompt: 'AI prompt',
  latest_comment: 'Latest comment',
}

/**
 * Available field types for creating new fields (All 27 Baserow field types in exact screenshot order)
 */
export const AVAILABLE_FIELD_TYPES = [
  'text',
  'long_text',
  'link_row',
  'number',
  'rating',
  'boolean',
  'date',
  'last_modified_on',
  'last_modified_by',
  'created_on',
  'created_by',
  'duration',
  'url',
  'email',
  'single_select',
  'multiple_select',
  'phone_number',
  'formula',
  'count',
  'rollup',
  'lookup',
  'collaborators',
  'uuid',
  'autonumber',
  'password',
  'edit_row_link',
  'ai_prompt',
  'latest_comment',
]

/**
 * Default rollup functions for aggregation fields
 */
export const ROLLUP_FUNCTIONS = [
  'sum',
  'count',
  'count_all',
  'avg',
  'min',
  'max',
  'concat',
  'array_join',
  'array_unique',
  'bool_and',
  'bool_or',
]

/**
 * Filter operators per field type (single source for the filter menu)
 */
const OPERATOR_LABEL_KEYS: Record<FilterOperator, string> = {
  contains: 'filter.contains',
  not_contains: 'filter.notContains',
  equals: 'filter.equals',
  not_equals: 'filter.notEquals',
  empty: 'filter.isEmpty',
  not_empty: 'filter.isNotEmpty',
  higher_than: 'filter.higherThan',
  higher_than_or_equal: 'filter.higherThanOrEqual',
  lower_than: 'filter.lowerThan',
  lower_than_or_equal: 'filter.lowerThanOrEqual',
  date_equal: 'filter.dateIs',
  date_before: 'filter.dateBefore',
  date_after: 'filter.dateAfter',
  date_on_or_before: 'filter.dateOnOrBefore',
  date_on_or_after: 'filter.dateOnOrAfter',
  date_within: 'filter.dateWithin',
  is_any_of: 'filter.isAnyOf',
  is_none_of: 'filter.isNoneOf',
  has_any_of: 'filter.hasAnyOf',
  has_all_of: 'filter.hasAllOf',
  has_none_of: 'filter.hasNoneOf',
  is_exactly: 'filter.isExactly',
}

const NUMERIC_FILTER_TYPES = ['number', 'rating', 'autonumber', 'percent', 'currency']
const DATE_FILTER_TYPES = ['date', 'created_on', 'last_modified_on']
const ID_FILTER_TYPES = ['link_row', 'collaborator']

const OPERATORS_BY_KIND: Record<string, FilterOperator[]> = {
  text: ['contains', 'not_contains', 'equals', 'not_equals', 'empty', 'not_empty'],
  number: ['equals', 'not_equals', 'higher_than', 'higher_than_or_equal', 'lower_than', 'lower_than_or_equal', 'empty', 'not_empty'],
  single_select: ['equals', 'not_equals', 'is_any_of', 'is_none_of', 'empty', 'not_empty'],
  multiple_select: ['has_any_of', 'has_all_of', 'has_none_of', 'is_exactly', 'empty', 'not_empty'],
  id_list: ['contains', 'has_any_of', 'has_all_of', 'has_none_of', 'empty', 'not_empty'],
  date: ['date_equal', 'date_before', 'date_after', 'date_on_or_before', 'date_on_or_after', 'date_within', 'empty', 'not_empty'],
  boolean: ['equals'],
}

function operatorKind(fieldType: string | undefined): string {
  if (!fieldType) return 'text'
  if (NUMERIC_FILTER_TYPES.includes(fieldType)) return 'number'
  if (DATE_FILTER_TYPES.includes(fieldType)) return 'date'
  if (ID_FILTER_TYPES.includes(fieldType)) return 'id_list'
  if (fieldType in OPERATORS_BY_KIND) return fieldType
  return 'text'
}

export function getFilterOperators(fieldType: string | undefined): { value: FilterOperator; labelKey: string }[] {
  return OPERATORS_BY_KIND[operatorKind(fieldType)].map(value => ({ value, labelKey: OPERATOR_LABEL_KEYS[value] }))
}

export const MULTI_VALUE_OPERATORS: FilterOperator[] = ['is_any_of', 'is_none_of', 'has_any_of', 'has_all_of', 'has_none_of', 'is_exactly']
export const DATE_OPERATORS: FilterOperator[] = ['date_equal', 'date_before', 'date_after', 'date_on_or_before', 'date_on_or_after', 'date_within']
export const NO_VALUE_OPERATORS: FilterOperator[] = ['empty', 'not_empty']
export const DATE_COMPARE_MODES: DateFilterMode[] = ['exact', 'today', 'tomorrow', 'yesterday', 'days_ago', 'days_from_now']
export const DATE_WITHIN_MODES: DateFilterMode[] = ['past_week', 'past_month', 'past_year', 'next_week', 'next_month', 'next_year', 'past_n_days', 'next_n_days']
export const DATE_MODE_LABEL_KEYS: Record<DateFilterMode, string> = {
  exact: 'filter.modeExact',
  today: 'filter.modeToday',
  tomorrow: 'filter.modeTomorrow',
  yesterday: 'filter.modeYesterday',
  days_ago: 'filter.modeDaysAgo',
  days_from_now: 'filter.modeDaysFromNow',
  past_week: 'filter.modePastWeek',
  past_month: 'filter.modePastMonth',
  past_year: 'filter.modePastYear',
  next_week: 'filter.modeNextWeek',
  next_month: 'filter.modeNextMonth',
  next_year: 'filter.modeNextYear',
  past_n_days: 'filter.modePastNDays',
  next_n_days: 'filter.modeNextNDays',
}
export const DATE_MODES_WITH_AMOUNT: DateFilterMode[] = ['days_ago', 'days_from_now', 'past_n_days', 'next_n_days']

/**
 * Row color options
 */
export const ROW_COLOR_OPTIONS = [
  { value: 'red', label: '紅色', hex: '#ff4444' },
  { value: 'green', label: '綠色', hex: '#44ff44' },
  { value: 'blue', label: '藍色', hex: '#4444ff' },
  { value: 'yellow', label: '黃色', hex: '#ffff44' },
  { value: 'none', label: '無', hex: 'transparent' },
]
