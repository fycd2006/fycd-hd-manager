/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CardDrawer } from '../CardDrawer'

describe('CardDrawer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders nothing when show is false', () => {
    const { container } = render(
      <CardDrawer
        show={false}
        tableId={10}
        rowId={100}
        onClose={jest.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('fetches schema and row data when opened, and renders form fields', async () => {
    const mockFields = [
      { id: 1, tableId: 10, name: 'Title', type: 'text', order: 0 },
      { id: 2, tableId: 10, name: 'Amount', type: 'number', order: 1 },
    ]
    const mockRows = [
      { id: 100, tableId: 10, data: JSON.stringify({ field_1: 'Invoice #100', field_2: 1200 }) },
    ]

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tables/10/fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockFields,
        })
      }
      if (url.includes('/api/tables/10/rows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ rows: mockRows }),
        })
      }
      return Promise.reject(new Error('Unknown url: ' + url))
    })

    render(
      <CardDrawer
        show={true}
        tableId={10}
        rowId={100}
        tableName="Finance Invoices"
        onClose={jest.fn()}
      />
    )

    // Initially shows loading
    expect(screen.getByTestId('card-drawer-loading')).toBeInTheDocument()

    // Waits for data to load
    await waitFor(() => {
      expect(screen.getByText('Finance Invoices')).toBeInTheDocument()
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Invoice #100')).toBeInTheDocument()
      expect(screen.getByDisplayValue('1200')).toBeInTheDocument()
    })
  })

  it('handles field edit and sends PATCH request with auto-save', async () => {
    const mockFields = [
      { id: 1, tableId: 10, name: 'Title', type: 'text', order: 0 },
    ]
    const mockRows = [
      { id: 100, tableId: 10, data: JSON.stringify({ field_1: 'Old Title' }) },
    ]

    ;(global.fetch as jest.Mock).mockImplementation((url: string, opts?: any) => {
      if (opts?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 100, data: { field_1: 'New Title' } }),
        })
      }
      if (url.includes('/api/tables/10/fields')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockFields,
        })
      }
      if (url.includes('/api/tables/10/rows')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ rows: mockRows }),
        })
      }
      return Promise.reject(new Error('Unknown url: ' + url))
    })

    const onRowUpdated = jest.fn()

    render(
      <CardDrawer
        show={true}
        tableId={10}
        rowId={100}
        tableName="Finance Invoices"
        onClose={jest.fn()}
        onRowUpdated={onRowUpdated}
      />
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument()
    })

    const input = screen.getByDisplayValue('Old Title')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/tables/10/rows',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowId: 100, fieldKey: 'field_1', value: 'New Title' }),
        })
      )
      expect(onRowUpdated).toHaveBeenCalledWith(100, { field_1: 'New Title' })
    })
  })

  it('renders error state when fetch fails', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ error: '權限不足' }),
      })
    )

    render(
      <CardDrawer
        show={true}
        tableId={10}
        rowId={100}
        onClose={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('card-drawer-error')).toBeInTheDocument()
      expect(screen.getByText('權限不足')).toBeInTheDocument()
    })
  })

  it('triggers onClose when close button is clicked or Escape key is pressed', async () => {
    const mockFields = [
      { id: 1, tableId: 10, name: 'Title', type: 'text', order: 0 },
    ]
    const mockRows = [
      { id: 100, tableId: 10, data: JSON.stringify({ field_1: 'Test' }) },
    ]

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tables/10/fields')) return Promise.resolve({ ok: true, json: async () => mockFields })
      if (url.includes('/api/tables/10/rows')) return Promise.resolve({ ok: true, json: async () => ({ rows: mockRows }) })
      return Promise.reject(new Error('Unknown url'))
    })

    const onClose = jest.fn()

    render(
      <CardDrawer
        show={true}
        tableId={10}
        rowId={100}
        onClose={onClose}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('card-drawer-close')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('card-drawer-close'))
    expect(onClose).toHaveBeenCalledTimes(1)

    // Test Escape key
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('renders master view context info banner when isMasterViewContext is true', async () => {
    const mockFields = [
      { id: 1, tableId: 10, name: 'Title', type: 'text', order: 0 },
    ]
    const mockRows = [
      { id: 100, tableId: 10, data: JSON.stringify({ field_1: 'Master Item' }) },
    ]

    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/tables/10/fields')) return Promise.resolve({ ok: true, json: async () => mockFields })
      if (url.includes('/api/tables/10/rows')) return Promise.resolve({ ok: true, json: async () => ({ rows: mockRows }) })
      return Promise.reject(new Error('Unknown url'))
    })

    render(
      <CardDrawer
        show={true}
        tableId={10}
        rowId={100}
        tableName="Bugs Table"
        onClose={jest.fn()}
        isMasterViewContext={true}
      />
    )

    await waitFor(() => {
      const banner = screen.getByTestId('master-view-drawer-banner')
      expect(banner).toBeInTheDocument()
      expect(banner).toHaveTextContent('總表編輯情境')
      expect(banner).toHaveTextContent('Bugs Table')
    })
  })
})


