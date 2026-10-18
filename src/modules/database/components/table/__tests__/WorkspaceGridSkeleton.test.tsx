/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { WorkspaceGridSkeleton } from '../WorkspaceGridSkeleton'

describe('WorkspaceGridSkeleton', () => {
  it('renders both desktop and mobile layouts', () => {
    const { container } = render(<WorkspaceGridSkeleton />)
    expect(container.querySelector('.fycd-grid-skeleton-desktop')).not.toBeNull()
    expect(container.querySelector('.fycd-grid-skeleton-mobile')).not.toBeNull()
  })

  it('mobile layout uses the shared shimmer', () => {
    const { container } = render(<WorkspaceGridSkeleton />)
    const mobile = container.querySelector('.fycd-grid-skeleton-mobile')!
    expect(mobile.querySelectorAll('.fycd-skeleton').length).toBeGreaterThanOrEqual(8)
  })

  it('shows loading text outside the layout-specific containers so both layouts get it', () => {
    render(<WorkspaceGridSkeleton loadingText="載入資料中" />)
    const text = screen.getByText('載入資料中')
    expect(text.closest('.fycd-grid-skeleton-desktop')).toBeNull()
    expect(text.closest('.fycd-grid-skeleton-mobile')).toBeNull()
  })
})
