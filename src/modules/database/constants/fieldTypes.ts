/**
 * Database Module - Field Type Configuration
 * Icons and labels for different field types
 */

import React from 'react'
import { Icons } from './icons'

/**
 * Map field types to their corresponding icons
 */
export const FIELD_TYPE_ICONS: Record<string, () => React.ReactNode> = {
  text: Icons.Text,
  long_text: Icons.AlignLeft,
  number: Icons.Hash,
  boolean: Icons.Check,
  date: Icons.Calendar,
  single_select: Icons.List,
  multiple_select: Icons.List,
  url: Icons.Link,
  email: Icons.Mail,
  link_row: Icons.Database,
  lookup: Icons.Search,
  rollup: Icons.Columns,
  formula: Icons.Hash,
  created_on: Icons.Calendar,
  last_modified_on: Icons.Calendar,
  created_by: Icons.Text,
  last_modified_by: Icons.Text,
  activity_log: Icons.AlignLeft,
  collaborator: Icons.Users,
  autonumber: Icons.Hash,
  phone: Icons.Phone,
}

/**
 * Map field types to human-readable labels (in Traditional Chinese)
 */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: '單行文字',
  long_text: '多行文字',
  number: '數字',
  boolean: '是/否',
  date: '日期',
  single_select: '單選標籤',
  multiple_select: '多選標籤',
  url: '網址',
  email: '電子郵件',
  phone: '電話號碼 (Phone)',
  link_row: '連結其它資料表 (Link Row)',
  lookup: '查閱關聯欄位 (Lookup)',
  rollup: '聚合關聯欄位 (Rollup)',
  formula: '公式運算欄位 (Formula)',
  activity_log: '對話/歷程日誌 (History Log)',
  collaborator: '協作者指派 (Collaborator)',
  autonumber: '自動遞增序號 (Autonumber)',
  created_on: '建立時間 (Auto Created on)',
  last_modified_on: '修改時間 (Auto Modified on)',
  created_by: '建立者 (Auto Created by)',
  last_modified_by: '修改者 (Auto Modified by)',
}

/**
 * Available field types for creating new fields
 */
export const AVAILABLE_FIELD_TYPES = [
  'text',
  'long_text',
  'number',
  'boolean',
  'date',
  'single_select',
  'multiple_select',
  'email',
  'url',
  'phone',
  'link_row',
  'lookup',
  'rollup',
  'formula',
  'collaborator',
  'autonumber',
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
 * Field operators for filtering
 */
export const FILTER_OPERATORS = {
  text: ['contains', 'not_contains', 'equals', 'not_equals', 'empty', 'not_empty'],
  number: ['equals', 'not_equals', 'higher_than', 'higher_than_or_equal', 'lower_than', 'lower_than_or_equal', 'empty', 'not_empty'],
  boolean: ['equals'],
  date: ['date_equal', 'date_before', 'date_after', 'empty', 'not_empty'],
  default: ['contains', 'not_contains', 'equals', 'not_equals', 'empty', 'not_empty'],
}

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
