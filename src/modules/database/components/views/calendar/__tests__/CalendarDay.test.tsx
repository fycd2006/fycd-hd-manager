/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import CalendarView from '../CalendarView'

jest.mock('@/lib/i18n/i18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-TW',
  }),
}))

describe('CalendarView day placement', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-15T04:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('places a time-zone-shifted instant in the field time zone day cell', () => {
    const fields = [
      { id: 1, name: 'Title', type: 'text' },
      {
        id: 2,
        name: 'When',
        type: 'date',
        options: { date_include_time: true, date_time_zone: 'Asia/Taipei' },
      },
    ]
    const rows = [
      { id: 1, order: 0, data: { field_1: 'Night shift', field_2: '2026-10-17T23:59:00.000Z' } },
    ]

    render(<CalendarView fields={fields} rows={rows} onExpandRow={jest.fn()} />)

    const card = screen.getByText('Night shift')
    const cell = card.parentElement!.parentElement!
    expect(cell.firstElementChild!.textContent).toMatch(/^18/)
  })
})
