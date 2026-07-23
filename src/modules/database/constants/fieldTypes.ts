/**
 * Database Module - Field Type Configuration
 * Icons and labels for different field types
 */

import React from 'react'
import { 
  Type, AlignLeft, Plug, Hash, Star, CheckCircle2, Calendar, Edit3, User, 
  Plus, UserCheck, Clock, Link2, Mail, CheckCircle, List, Phone, Calculator, 
  Grid, Box, Glasses, Users, Tag, Binary, Lock, FileEdit, Sparkles
} from 'lucide-react'

/**
 * Map all 27 field types to their corresponding Lucide icons matching Baserow
 */
export const FIELD_TYPE_ICONS: Record<string, () => React.ReactNode> = {
  text: () => React.createElement(Type, { size: 14 }),
  long_text: () => React.createElement(AlignLeft, { size: 14 }),
  link_row: () => React.createElement(Plug, { size: 14 }),
  number: () => React.createElement(Hash, { size: 14 }),
  rating: () => React.createElement(Star, { size: 14 }),
  boolean: () => React.createElement(CheckCircle2, { size: 14 }),
  date: () => React.createElement(Calendar, { size: 14 }),
  last_modified_on: () => React.createElement(Edit3, { size: 14 }),
  last_modified_by: () => React.createElement(User, { size: 14 }),
  created_on: () => React.createElement(Plus, { size: 14 }),
  created_by: () => React.createElement(UserCheck, { size: 14 }),
  duration: () => React.createElement(Clock, { size: 14 }),
  url: () => React.createElement(Link2, { size: 14 }),
  email: () => React.createElement(Mail, { size: 14 }),
  single_select: () => React.createElement(CheckCircle, { size: 14 }),
  multiple_select: () => React.createElement(List, { size: 14 }),
  phone: () => React.createElement(Phone, { size: 14 }),
  phone_number: () => React.createElement(Phone, { size: 14 }),
  formula: () => React.createElement(Calculator, { size: 14 }),
  count: () => React.createElement(Grid, { size: 14 }),
  rollup: () => React.createElement(Box, { size: 14 }),
  lookup: () => React.createElement(Glasses, { size: 14 }),
  collaborator: () => React.createElement(Users, { size: 14 }),
  collaborators: () => React.createElement(Users, { size: 14 }),
  uuid: () => React.createElement(Tag, { size: 14 }),
  autonumber: () => React.createElement(Binary, { size: 14 }),
  password: () => React.createElement(Lock, { size: 14 }),
  edit_row_link: () => React.createElement(FileEdit, { size: 14 }),
  ai_prompt: () => React.createElement(Sparkles, { size: 14 }),
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
