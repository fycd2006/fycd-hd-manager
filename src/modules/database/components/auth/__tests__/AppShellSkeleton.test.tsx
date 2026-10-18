/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppShellSkeleton from '../AppShellSkeleton'

jest.mock('@/lib/i18n/i18nContext', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: 'zh-TW' }),
}))

describe('AppShellSkeleton', () => {
  it('renders an accessible loading status', () => {
    render(<AppShellSkeleton />)
    const status = screen.getByRole('status', { name: 'auth.loadingWorkspace' })
    expect(status).toHaveAttribute('aria-busy', 'true')
  })

  it('renders sidebar, toolbar and a 5-column grid with header + 7 rows', () => {
    const { container } = render(<AppShellSkeleton />)
    expect(container.querySelector('[data-part="sidebar"]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-part="toolbar"] .fycd-skeleton')).toHaveLength(3)
    const rows = container.querySelectorAll('[data-part="grid-row"]')
    expect(rows).toHaveLength(8)
    rows.forEach(r => expect(r.querySelectorAll('.fycd-skeleton')).toHaveLength(5))
  })
})
