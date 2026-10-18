/** @jest-environment jsdom */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import RowEditModal from '../RowEditModal'
import type { TableField, TableRow } from '@/modules/database/types'

jest.mock('../RowCommentsPanel', () => function MockComments() { return null })

describe('RowEditModal audit date fields', () => {
  it('formats created_on / last_modified_on with the field date options', () => {
    const fields: TableField[] = [
      { id: 1, tableId: 1, name: '名稱', type: 'text', order: 0, options: null },
      { id: 2, tableId: 1, name: '建立時間', type: 'created_on', order: 1, options: JSON.stringify({ date_time_zone: 'Asia/Taipei' }) },
      { id: 3, tableId: 1, name: '修改時間', type: 'last_modified_on', order: 2, options: JSON.stringify({ date_time_zone: 'Asia/Taipei', date_format: 'us', date_time_format: '12' }) },
    ]
    const row: TableRow = {
      id: 7,
      tableId: 1,
      order: 0,
      createdAt: '2026-10-18T06:30:00.000Z',
      data: { field_1: 'A', field_2: '2026-10-18T06:30:00.000Z', field_3: '2026-10-18T07:05:00.000Z' },
    }
    render(<RowEditModal show row={row} fields={fields} onClose={jest.fn()} />)
    expect(screen.getByText('2026-10-18 14:30')).toBeInTheDocument()
    expect(screen.getByText('10/18/2026 3:05 PM')).toBeInTheDocument()
    expect(screen.queryByText('2026-10-18T06:30:00.000Z')).not.toBeInTheDocument()
  })
})
