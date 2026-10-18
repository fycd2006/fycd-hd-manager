/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react'
import { useTableCSV } from '../useTableCSV'
import * as fieldService from '@/modules/database/services/field'
import * as rowService from '@/modules/database/services/row'
import type { TableField, TableRow } from '@/modules/database/types'

jest.mock('@/modules/database/services/field')
jest.mock('@/modules/database/services/row')

describe('useTableCSV', () => {
  const mockFields: TableField[] = [
    { id: 1, tableId: 10, name: '姓名', type: 'text', order: 1, options: null },
    { id: 2, tableId: 10, name: '年齡', type: 'number', order: 2, options: null },
  ]

  const mockRows: TableRow[] = [
    { id: 101, tableId: 10, order: 1, data: { field_1: '小明', field_2: 20 }, createdAt: '' },
  ]

  const mockWorkspaces = [
    {
      id: 1,
      databases: [
        {
          id: 1,
          tables: [{ id: 10, name: '成員名單' }],
        },
      ],
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects files larger than 15MB with a toast message', async () => {
    const addToast = jest.fn()
    const { result } = renderHook(() =>
      useTableCSV({
        activeTableId: 10,
        fields: mockFields,
        rows: mockRows,
        hiddenFieldKeys: [],
        workspaces: mockWorkspaces,
        setFields: jest.fn(),
        setGridLoading: jest.fn(),
        fetchTableData: jest.fn(),
        addToast,
      })
    )

    // Simulate an oversized file (16MB)
    const largeFile = new File(['x'.repeat(100)], 'large.csv', { type: 'text/csv' })
    Object.defineProperty(largeFile, 'size', { value: 16 * 1024 * 1024 })

    await act(async () => {
      await result.current.handleCSVImport({
        target: { files: [largeFile] },
      } as any)
    })

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('檔案過大'),
      'error'
    )
  })

  it('successfully parses CSV, creates new fields with inference, and calls batchCreateRows', async () => {
    const addToast = jest.fn()
    const fetchTableData = jest.fn()
    const setFields = jest.fn()
    const setGridLoading = jest.fn()

    ;(fieldService.createField as jest.Mock).mockResolvedValue({ ok: true })
    ;(fieldService.fetchFields as jest.Mock).mockResolvedValue([
      ...mockFields,
      { id: 3, tableId: 10, name: '已繳費', type: 'boolean', order: 3, options: null },
    ])
    ;(rowService.batchCreateRows as jest.Mock).mockResolvedValue({ ok: true, count: 2 })

    const { result } = renderHook(() =>
      useTableCSV({
        activeTableId: 10,
        fields: mockFields,
        rows: mockRows,
        hiddenFieldKeys: [],
        workspaces: mockWorkspaces,
        setFields,
        setGridLoading,
        fetchTableData,
        addToast,
      })
    )

    const csvContent = `姓名,年齡,已繳費\n王大同,30,是\n陳小芬,25,否`
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.handleCSVImport({
        target: { files: [file] },
      } as any)
    })

    // Expect fieldService.createField was called for '已繳費' with inferred boolean type
    expect(fieldService.createField).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        name: '已繳費',
        type: 'boolean',
      })
    )

    // Expect rowService.batchCreateRows was called with properly mapped data
    expect(rowService.batchCreateRows).toHaveBeenCalledWith(
      10,
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            field_1: '王大同',
            field_2: '30',
            field_3: '是',
          }),
        }),
        expect.objectContaining({
          data: expect.objectContaining({
            field_1: '陳小芬',
            field_2: '25',
            field_3: '否',
          }),
        }),
      ])
    )

    expect(fetchTableData).toHaveBeenCalledWith(10)
    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('共匯入 2 筆資料'),
      'success'
    )
  })

  it('accumulates rejected cells across import batches and shows the summary toast', async () => {
    const addToast = jest.fn()
    ;(fieldService.fetchFields as jest.Mock).mockResolvedValue(mockFields)
    ;(rowService.batchCreateRows as jest.Mock)
      .mockResolvedValueOnce({ ok: true, rows: [], rejected: [{ clientId: 'a', fieldId: 2, code: 'invalid_number', reason: '必須是有效的數字' }] })
      .mockResolvedValueOnce({ ok: true, rows: [], rejected: [{ clientId: 'b', fieldId: 2, code: 'invalid_number', reason: '必須是有效的數字' }] })

    const { result } = renderHook(() =>
      useTableCSV({
        activeTableId: 10,
        fields: mockFields,
        rows: mockRows,
        hiddenFieldKeys: [],
        workspaces: mockWorkspaces,
        setFields: jest.fn(),
        setGridLoading: jest.fn(),
        fetchTableData: jest.fn(),
        addToast,
      })
    )

    // 101 data rows -> two batches of BATCH_IMPORT_SIZE (100) and 1; 2 cells per row
    const lines = Array.from({ length: 101 }, (_, i) => `人${i},${i === 0 || i === 100 ? 'abc' : i}`)
    const file = new File([`姓名,年齡\n${lines.join('\n')}`], 'test.csv', { type: 'text/csv' })

    await act(async () => {
      await result.current.handleCSVImport({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>)
    })

    expect(rowService.batchCreateRows).toHaveBeenCalledTimes(2)
    expect(addToast).toHaveBeenCalledWith('已寫入 200 格，2 格未寫入：年齡 必須是有效的數字', 'info')
  })
})
