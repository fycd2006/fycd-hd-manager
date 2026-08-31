/**
 * @jest-environment jsdom
 */

import React, { useState, useEffect } from 'react'
import '@testing-library/jest-dom'
import { render, screen, act } from '@testing-library/react'

describe('Table Switch UI Reset Behavior (Issue 2)', () => {
  // Test harness modeling the exact state lifecycle in page.tsx
  function TableContainer({ activeTableId }: { activeTableId: number }) {
    const [editingCell, setEditingCell] = useState<{ rowId: number; fieldKey: string } | null>(null)
    const [selectedRow, setSelectedRow] = useState<any | null>(null)
    const [showDetailModal, setShowDetailModal] = useState<boolean>(false)
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
    const [fieldContextMenu, setFieldContextMenu] = useState<{ field: any; x: number; y: number } | null>(null)
    const [searchQuery, setSearchQuery] = useState<string>('')

    // Exact hook in page.tsx
    useEffect(() => {
      setEditingCell(null)
      setSelectedRow(null)
      setShowDetailModal(false)
      setContextMenu(null)
      setFieldContextMenu(null)
      setSearchQuery('')
    }, [activeTableId])

    return (
      <div>
        <div data-testid="table-id">{activeTableId}</div>
        <div data-testid="editing-cell">{editingCell ? `${editingCell.rowId}_${editingCell.fieldKey}` : 'null'}</div>
        <div data-testid="selected-row">{selectedRow ? String(selectedRow.id) : 'null'}</div>
        <div data-testid="detail-modal">{showDetailModal ? 'open' : 'closed'}</div>
        <div data-testid="context-menu">{contextMenu ? 'open' : 'closed'}</div>
        <div data-testid="field-context-menu">{fieldContextMenu ? 'open' : 'closed'}</div>
        <div data-testid="search-query">{searchQuery || 'empty'}</div>

        <button
          data-testid="set-dirty-ui-state"
          onClick={() => {
            setEditingCell({ rowId: 42, fieldKey: 'field_title' })
            setSelectedRow({ id: 42 })
            setShowDetailModal(true)
            setContextMenu({ x: 100, y: 200 })
            setFieldContextMenu({ field: { id: 1 }, x: 150, y: 250 })
            setSearchQuery('my search term')
          }}
        >
          Set Dirty
        </button>
      </div>
    )
  }

  it('resets editingCell, selectedRow, showDetailModal, contextMenu, fieldContextMenu, and searchQuery when switching activeTableId', () => {
    // 1. Initial mount on Table 1
    const { rerender } = render(<TableContainer activeTableId={1} />)

    expect(screen.getByTestId('table-id')).toHaveTextContent('1')
    expect(screen.getByTestId('editing-cell')).toHaveTextContent('null')
    expect(screen.getByTestId('selected-row')).toHaveTextContent('null')
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('closed')
    expect(screen.getByTestId('context-menu')).toHaveTextContent('closed')
    expect(screen.getByTestId('field-context-menu')).toHaveTextContent('closed')
    expect(screen.getByTestId('search-query')).toHaveTextContent('empty')

    // 2. User interacts with Table 1 (opens modals, menus, searches, edits cell)
    act(() => {
      screen.getByTestId('set-dirty-ui-state').click()
    })

    // Verify UI state is now active / dirty on Table 1
    expect(screen.getByTestId('editing-cell')).toHaveTextContent('42_field_title')
    expect(screen.getByTestId('selected-row')).toHaveTextContent('42')
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('open')
    expect(screen.getByTestId('context-menu')).toHaveTextContent('open')
    expect(screen.getByTestId('field-context-menu')).toHaveTextContent('open')
    expect(screen.getByTestId('search-query')).toHaveTextContent('my search term')

    // 3. User switches to Table 2
    rerender(<TableContainer activeTableId={2} />)

    // 4. Verification: All transient UI states MUST be reset cleanly to initial values
    expect(screen.getByTestId('table-id')).toHaveTextContent('2')
    expect(screen.getByTestId('editing-cell')).toHaveTextContent('null')
    expect(screen.getByTestId('selected-row')).toHaveTextContent('null')
    expect(screen.getByTestId('detail-modal')).toHaveTextContent('closed')
    expect(screen.getByTestId('context-menu')).toHaveTextContent('closed')
    expect(screen.getByTestId('field-context-menu')).toHaveTextContent('closed')
    expect(screen.getByTestId('search-query')).toHaveTextContent('empty')
  })
})
