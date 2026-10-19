/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react'
import { useViewConfig } from '../useViewConfig'
import * as viewService from '@/modules/database/services/view'
import type { TableView } from '@/modules/database/types'

jest.mock('@/modules/database/services/view', () => ({
  updateViewConfig: jest.fn().mockResolvedValue({ ok: true }),
  createView: jest.fn(),
}))

const baseView: TableView = {
  id: 1,
  tableId: 10,
  name: '主視圖',
  type: 'grid',
  filters: null,
  sortField: 'field_2',
  sortOrder: 'desc',
  sortRules: '[{"fieldKey":"field_2","order":"desc"},{"fieldKey":"field_3","order":"asc"}]',
  hiddenFields: null,
  rowColors: null,
  groupByField: 'field_5',
  groupByRules: '[{"fieldKey":"field_5","order":"asc"}]',
}

function setup() {
  const hook = renderHook(() =>
    useViewConfig({ activeTableId: 10, activeViewId: 1, setActiveViewId: jest.fn(), addToast: jest.fn() })
  )
  act(() => {
    hook.result.current.setViews([baseView])
    hook.result.current.applyViewConfig(baseView)
  })
  return hook
}

describe('useViewConfig — multi-level sort persistence', () => {
  beforeEach(() => jest.clearAllMocks())

  it('toggleSort replaces saved sortRules with the single toggled rule', () => {
    const { result } = setup()
    act(() => result.current.toggleSort('field_7'))
    expect(result.current.sortRules).toEqual([{ fieldKey: 'field_7', order: 'asc' }])
    expect(viewService.updateViewConfig).toHaveBeenCalledWith(10, 1, expect.objectContaining({
      sortField: 'field_7',
      sortOrder: 'asc',
      sortRules: [{ fieldKey: 'field_7', order: 'asc' }],
    }))
  })

  it('toggleSort clearing the sort also clears sortRules', () => {
    const { result } = setup()
    act(() => result.current.toggleSort('field_2')) // desc → off
    expect(result.current.sortRules).toEqual([])
    expect(viewService.updateViewConfig).toHaveBeenCalledWith(10, 1, expect.objectContaining({ sortField: null, sortRules: [] }))
  })

  it('duplicating a view copies sortRules and groupByRules', async () => {
    ;(viewService.createView as jest.Mock).mockResolvedValue({ ok: true, view: { ...baseView, id: 2, sortRules: null, groupByRules: null } })
    const { result } = setup()
    await act(async () => { await result.current.handleDuplicateView(1) })
    expect(viewService.updateViewConfig).toHaveBeenCalledWith(10, 2, expect.objectContaining({
      sortRules: baseView.sortRules,
      groupByRules: baseView.groupByRules,
    }))
  })
})
