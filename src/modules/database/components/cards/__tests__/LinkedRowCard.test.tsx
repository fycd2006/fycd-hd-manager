/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LinkedRowCard } from '../LinkedRowCard'

describe('LinkedRowCard UI Component', () => {
  it('renders access-denied masked state when _accessDenied is true', () => {
    const onOpenDetail = jest.fn()
    const onDetach = jest.fn()

    render(
      <LinkedRowCard
        item={{
          id: 101,
          tableId: 5,
          _accessDenied: true,
        }}
        onOpenDetail={onOpenDetail}
        onDetach={onDetach}
        showDetachButton={true}
      />
    )

    // Should display masked label
    expect(screen.getByTestId('linked-row-card-denied')).toBeInTheDocument()
    expect(screen.getByText('無存取權限')).toBeInTheDocument()

    // Clicking denied card must not trigger open detail
    fireEvent.click(screen.getByTestId('linked-row-card-denied'))
    expect(onOpenDetail).not.toHaveBeenCalled()

    // Detach button should be visible and clickable to allow cleaning orphaned links
    const detachBtn = screen.getByTestId('detach-denied-button')
    expect(detachBtn).toBeInTheDocument()
    fireEvent.click(detachBtn)
    expect(onDetach).toHaveBeenCalledWith(101, expect.any(Object))
  })

  it('renders authorized card and triggers onOpenDetail when clicked', () => {
    const onOpenDetail = jest.fn()
    const onDetach = jest.fn()

    render(
      <LinkedRowCard
        item={{
          id: 202,
          tableId: 10,
          value: 'Acme Corporation',
          tableName: 'Companies',
          _accessDenied: false,
          previewFields: [
            { id: 1, name: 'Industry', type: 'text', value: 'Technology' },
            { id: 2, name: 'Headcount', type: 'number', value: 150 },
          ],
        }}
        onOpenDetail={onOpenDetail}
        onDetach={onDetach}
        showDetachButton={true}
      />
    )

    const chip = screen.getByTestId('linked-row-card-chip')
    expect(chip).toBeInTheDocument()
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument()

    // Click chip to open detail
    fireEvent.click(chip)
    expect(onOpenDetail).toHaveBeenCalledWith(202, 10, expect.any(Object))

    // Click detach button
    const detachBtn = screen.getByTestId('detach-button')
    fireEvent.click(detachBtn)
    expect(onDetach).toHaveBeenCalledWith(202, expect.any(Object))
  })

  it('shows and hides preview popover on mouseEnter and mouseLeave', () => {
    render(
      <LinkedRowCard
        item={{
          id: 303,
          tableId: 12,
          value: 'Project Alpha',
          tableName: 'Projects',
          _accessDenied: false,
          previewFields: [
            { id: 1, name: 'Status', type: 'text', value: 'Active' },
            { id: 2, name: 'Budget', type: 'number', value: 50000 },
          ],
        }}
      />
    )

    const wrapper = screen.getByTestId('linked-row-card')

    // Popover is initially not in DOM
    expect(screen.queryByTestId('linked-row-popover')).not.toBeInTheDocument()

    // Hover to show
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByTestId('linked-row-popover')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    // Mouse leave to hide
    fireEvent.mouseLeave(wrapper)
    expect(screen.queryByTestId('linked-row-popover')).not.toBeInTheDocument()
  })

  it('respects disabled prop and prevents interaction', () => {
    const onOpenDetail = jest.fn()

    render(
      <LinkedRowCard
        item={{
          id: 404,
          value: 'Disabled Row',
          _accessDenied: false,
        }}
        onOpenDetail={onOpenDetail}
        disabled={true}
      />
    )

    const chip = screen.getByTestId('linked-row-card-chip')
    fireEvent.click(chip)
    expect(onOpenDetail).not.toHaveBeenCalled()
  })
})
