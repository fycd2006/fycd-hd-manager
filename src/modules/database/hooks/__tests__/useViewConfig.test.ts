/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useViewConfig } from '../useViewConfig'
import * as viewService from '@/modules/database/services/view'
import type { TableView } from '@/modules/database/types'

jest.mock('@/modules/database/services/view')

describe('useViewConfig - rowHeight persistence', () => {
  const mockSetActiveViewId = jest.fn()
  const mockAddToast = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const baseView: TableView = {
    id: 1,
    tableId: 10,
    name: 'Grid 1',
    type: 'grid',
    filters: null,
    sortField: null,
    sortOrder: 'asc',
    hiddenFields: null,
    columnWidths: null,
    rowColors: null,
    groupByField: null,
    aggregations: null,
  }

  it('normalizes rowHeight when applyViewConfig is called', () => {
    const { result } = renderHook(() =>
      useViewConfig({
        activeTableId: 10,
        activeViewId: 1,
        setActiveViewId: mockSetActiveViewId,
        addToast: mockAddToast,
      })
    )

    // rowHeight: null -> 'small'
    act(() => {
      result.current.applyViewConfig({ ...baseView, rowHeight: null })
    })
    expect(result.current.rowHeight).toBe('small')

    // rowHeight: 'extra' -> 'extra'
    act(() => {
      result.current.applyViewConfig({ ...baseView, rowHeight: 'extra' })
    })
    expect(result.current.rowHeight).toBe('extra')

    // rowHeight: 'huge' (invalid) -> 'small'
    act(() => {
      result.current.applyViewConfig({ ...baseView, rowHeight: 'huge' as unknown as string })
    })
    expect(result.current.rowHeight).toBe('small')
  })

  it('calls viewService.updateViewConfig when setRowHeight is called with activeViewId', async () => {
    ;(viewService.updateViewConfig as jest.Mock).mockResolvedValue({ ok: true })

    const { result } = renderHook(() =>
      useViewConfig({
        activeTableId: 10,
        activeViewId: 1,
        setActiveViewId: mockSetActiveViewId,
        addToast: mockAddToast,
      })
    )

    act(() => {
      result.current.setRowHeight('medium')
    })

    expect(result.current.rowHeight).toBe('medium')
    expect(viewService.updateViewConfig).toHaveBeenCalledWith(
      10,
      1,
      expect.objectContaining({ rowHeight: 'medium' })
    )
  })

  it('preserves source view rowHeight on handleDuplicateView', async () => {
    const sourceView: TableView = {
      ...baseView,
      id: 5,
      name: 'Source View',
      rowHeight: 'large',
    }

    const duplicatedView: TableView = {
      ...sourceView,
      id: 6,
      name: 'Source View (Copy)',
    }

    ;(viewService.createView as jest.Mock).mockResolvedValue({
      ok: true,
      view: duplicatedView,
    })
    ;(viewService.updateViewConfig as jest.Mock).mockResolvedValue({ ok: true })

    const { result } = renderHook(() =>
      useViewConfig({
        activeTableId: 10,
        activeViewId: 5,
        setActiveViewId: mockSetActiveViewId,
        addToast: mockAddToast,
      })
    )

    // Set views list so sourceView can be found
    act(() => {
      result.current.setViews([sourceView])
    })

    await act(async () => {
      await result.current.handleDuplicateView(5)
    })

    expect(viewService.updateViewConfig).toHaveBeenCalledWith(
      10,
      6,
      expect.objectContaining({ rowHeight: 'large' })
    )
  })
})
