/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import { FilterMenu } from '../FilterMenu'
import type { FilterItem, TableField } from '@/modules/database/types'

const fields: TableField[] = [
  { id: 1, tableId: 1, name: '文字欄', type: 'text', order: 0, options: null },
  {
    id: 2, tableId: 1, name: '多選欄', type: 'multiple_select', order: 1,
    options: JSON.stringify({ select_options: [{ value: 'A' }, { value: 'B' }] }),
  },
]

function setup(filterRules: FilterItem[]) {
  const setFilterRules = jest.fn()
  render(
    <I18nProvider>
      <FilterMenu fields={fields} filterRules={filterRules} setFilterRules={setFilterRules} filterType="AND" setFilterType={jest.fn()} />
    </I18nProvider>
  )
  return setFilterRules
}

describe('FilterMenu', () => {
  beforeAll(() => {
    document.cookie = 'i18n_locale=zh-TW'
  })
  afterAll(() => {
    document.cookie = 'i18n_locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  })

  const textRule = { fieldKey: 'field_1', operator: 'contains' as const, value: '' }

  it('adds a condition group', () => {
    const setFilterRules = setup([textRule])
    fireEvent.click(screen.getByText('新增條件群組'))
    const next = setFilterRules.mock.calls[0][0] as FilterItem[]
    expect(next).toHaveLength(2)
    expect(next[1]).toEqual({ type: 'group', filterType: 'AND', rules: [textRule] })
  })

  it('group has no add-group button', () => {
    setup([textRule, { type: 'group', filterType: 'OR', rules: [textRule] }])
    expect(screen.getAllByText('新增條件群組')).toHaveLength(1)
  })

  it('shows multi-value picker for has_any_of', () => {
    setup([{ fieldKey: 'field_2', operator: 'has_any_of', value: '', values: [] }])
    expect(screen.getByText('選擇值')).toBeInTheDocument()
  })

  it('resets operator when switching field type', () => {
    const setFilterRules = setup([{ ...textRule, value: 'abc' }])
    fireEvent.click(screen.getByText('文字欄'))
    fireEvent.click(screen.getByText('多選欄'))
    const next = setFilterRules.mock.calls[0][0] as FilterItem[]
    expect(next[0]).toEqual({ fieldKey: 'field_2', operator: 'has_any_of', value: '' })
  })
})
