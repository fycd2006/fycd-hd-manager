/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MasterGridView } from '../MasterGridView'

// Mock CardDrawer
jest.mock('@/modules/database/components/cards/CardDrawer', () => ({
  CardDrawer: ({ show, tableName, onClose }: any) =>
    show ? (
      <div data-testid="mock-card-drawer">
        <span>Drawer for {tableName}</span>
        <button onClick={onClose} data-testid="mock-drawer-close">
          Close
        </button>
      </div>
    ) : null,
}))

describe('MasterGridView UI Component', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('fetches and renders multi-table rows and highlights overrides', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
          data: { Title: 'Project Alpha', Status: 'Overridden Status' },
          _hasOverride: true,
          _overrideKeys: ['Status'],
          _originalData: { Title: 'Project Alpha', Status: 'Draft' },
        },
        {
          id: 202,
          tableId: 2,
          createdAt: new Date('2026-01-02T00:00:00Z').toISOString(),
          data: { Title: 'Project Beta', Status: 'Completed' },
          _hasOverride: false,
        },
      ],
      nextCursor: 'mock_next_cursor_123',
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        workspaceName="Dev Workspace"
        tablesMap={{
          1: { name: 'Tasks Table', color: '#3b82f6' },
          2: { name: 'Issues Table', color: '#ef4444' },
        }}
      />
    )

    // Initial loading indicator
    expect(screen.getByText('正在彙整跨表資料列...')).toBeInTheDocument()

    // Rows rendered
    await waitFor(() => {
      expect(screen.getByTestId('source-table-badge-1')).toBeInTheDocument()
      expect(screen.getByTestId('source-table-badge-2')).toBeInTheDocument()
      expect(screen.getByText('Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('Project Beta')).toBeInTheDocument()
    })


    // Override badge should be present for row 101
    const overrideBadges = screen.getAllByTestId('override-badge')
    expect(overrideBadges).toHaveLength(1)
    expect(overrideBadges[0]).toHaveTextContent('覆寫')

    // Load More button should be present
    expect(screen.getByText('載入更多資料列')).toBeInTheDocument()
  })

  it('filters rows based on search input', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Frontend Redesign' },
        },
        {
          id: 102,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Backend Microservices' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Frontend Redesign')).toBeInTheDocument()
      expect(screen.getByText('Backend Microservices')).toBeInTheDocument()
    })

    // Search for "Backend"
    const searchInput = screen.getByPlaceholderText(/搜尋已載入資料/)
    fireEvent.change(searchInput, { target: { value: 'Backend' } })

    expect(screen.queryByText('Frontend Redesign')).not.toBeInTheDocument()
    expect(screen.getByText('Backend Microservices')).toBeInTheDocument()
  })

  it('opens CardDrawer when detail button is clicked', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 55,
          tableId: 10,
          createdAt: new Date().toISOString(),
          data: { Task: 'Critical Bug' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{ 10: { name: 'Bugs Table' } }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Critical Bug')).toBeInTheDocument()
    })

    // Click detail button
    const detailBtn = screen.getByTestId('open-drawer-btn')
    fireEvent.click(detailBtn)

    // Drawer opens
    expect(screen.getByTestId('mock-card-drawer')).toBeInTheDocument()
    expect(screen.getByText('Drawer for Bugs Table')).toBeInTheDocument()

    // Close drawer
    fireEvent.click(screen.getByTestId('mock-drawer-close'))
    expect(screen.queryByTestId('mock-card-drawer')).not.toBeInTheDocument()
  })

  it('toggles column sorting and triggers sorted API request', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Apple Task' },
        },
      ],
      nextCursor: null,
    }

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    })
    global.fetch = mockFetch as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Apple Task')).toBeInTheDocument()
    })

    // Click Title column header to sort ASC
    const titleHeader = screen.getByTestId('sort-header-Title')
    fireEvent.click(titleHeader)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sortField=Title&sortOrder=asc')
      )
      expect(screen.getByTestId('sort-asc-icon')).toBeInTheDocument()
    })

    // Click again to sort DESC
    fireEvent.click(screen.getByTestId('sort-header-Title'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('sortField=Title&sortOrder=desc')
      )
      expect(screen.getByTestId('sort-desc-icon')).toBeInTheDocument()
    })
  })

  it('opens filter bar, adds a filter rule, and triggers filtered API request', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Status: 'In Progress' },
        },
      ],
      nextCursor: null,
    }

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    })
    global.fetch = mockFetch as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    // Click Filter toggle button
    const filterBtn = screen.getByTestId('toggle-filter-btn')
    await act(async () => {
      fireEvent.click(filterBtn)
    })

    expect(screen.getByTestId('master-filter-bar')).toBeInTheDocument()

    // Click Add filter rule
    const addRuleBtn = screen.getByTestId('add-filter-rule-btn')
    await act(async () => {
      fireEvent.click(addRuleBtn)
    })

    expect(screen.getByTestId('filter-row-0')).toBeInTheDocument()

    // Change filter value
    const filterValInput = screen.getByTestId('filter-val-0')
    await act(async () => {
      fireEvent.change(filterValInput, { target: { value: 'In Progress' } })
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filters=')
      )
    })

    // Click Clear all filters
    const clearBtn = screen.getByTestId('clear-filters-btn')
    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(screen.queryByTestId('filter-row-0')).not.toBeInTheDocument()
  })

  it('renders summary footer and allows switching aggregation modes', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Amount: 100, City: 'Taipei' },
        },
        {
          id: 2,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Amount: 300, City: 'Tokyo' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('master-grid-footer')).toBeInTheDocument()
    })

    // Amount default summary should be Sum: Σ 400
    const amountSummary = screen.getByTestId('summary-text-Amount')
    expect(amountSummary).toHaveTextContent('Σ 400')

    // Switch Amount summary mode to average (avg)
    const amountSelect = screen.getByTestId('summary-select-Amount')
    await act(async () => {
      fireEvent.change(amountSelect, { target: { value: 'avg' } })
    })

    expect(amountSummary).toHaveTextContent('x̄ 200')

    // City default summary should be Count: 2 筆
    const citySummary = screen.getByTestId('summary-text-City')
    expect(citySummary).toHaveTextContent('2 筆')
  })

  it('manages column visibility and toggles sparse columns in MasterGridView', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Alpha', Status: 'Done', SecretNote: 'Private' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-Title')).toBeInTheDocument()
      expect(screen.getByTestId('sort-header-SecretNote')).toBeInTheDocument()
    })

    // Open Columns Visibility Manager
    const toggleColumnsBtn = screen.getByTestId('toggle-columns-btn')
    await act(async () => {
      fireEvent.click(toggleColumnsBtn)
    })

    expect(screen.getByTestId('master-columns-bar')).toBeInTheDocument()

    // Uncheck SecretNote column
    const secretNoteToggle = screen.getByTestId('column-toggle-SecretNote')
    const secretNoteCheckbox = secretNoteToggle.querySelector('input[type="checkbox"]')!
    await act(async () => {
      fireEvent.click(secretNoteCheckbox)
    })

    // SecretNote should be hidden from table header
    expect(screen.queryByTestId('sort-header-SecretNote')).not.toBeInTheDocument()
    // Title should still be visible
    expect(screen.getByTestId('sort-header-Title')).toBeInTheDocument()

    // Click "全部顯示"
    const selectAllBtn = screen.getByTestId('select-all-columns-btn')
    await act(async () => {
      fireEvent.click(selectAllBtn)
    })

    // SecretNote should be visible again
    expect(screen.getByTestId('sort-header-SecretNote')).toBeInTheDocument()
  })

  it('unifies fields with identical names across tables into a single column without displaying empty dashes', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { field_101: '台北客戶小王' },
        },
        {
          id: 2,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { field_205: '高雄客戶小李' },
        },
      ],
      fieldsMap: {
        field_101: { id: 101, tableId: 1, name: '客戶姓名', type: 'text' },
        field_205: { id: 205, tableId: 2, name: '客戶姓名', type: 'text' },
      },
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    // Should only have 1 unified header for "客戶姓名"
    await waitFor(() => {
      expect(screen.getByTestId('sort-header-客戶姓名')).toBeInTheDocument()
      expect(screen.getByText('台北客戶小王')).toBeInTheDocument()
      expect(screen.getByText('高雄客戶小李')).toBeInTheDocument()
    })

    // Neither row should render a dash '—' in place of client name
    const row1 = screen.getByTestId('master-row-1-1')
    const row2 = screen.getByTestId('master-row-2-2')
    expect(row1).toHaveTextContent('台北客戶小王')
    expect(row2).toHaveTextContent('高雄客戶小李')
  })

  it('renders permission notice banner when user has partial table access', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Accessible Task' },
        },
      ],
      permissionInfo: {
        totalTablesCount: 10,
        authorizedTablesCount: 7,
        hiddenTablesCount: 3,
      },
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('permission-banner')).toBeInTheDocument()
      expect(screen.getByText(/此總表共彙整了/)).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByTestId('footer-permission-info-icon')).toBeInTheDocument()
    })
  })

  it('displays column sources popover and supports unmerging a unified column', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { field_101: '張三' },
        },
        {
          id: 2,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { field_205: '李四' },
        },
      ],
      fieldsMap: {
        field_101: { id: 101, tableId: 1, name: '成員姓名', type: 'text' },
        field_205: { id: 205, tableId: 2, name: '成員姓名', type: 'number' }, // type mismatch
      },
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{ 1: { name: '開發部' }, 2: { name: '行銷部' } }}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-成員姓名')).toBeInTheDocument()
      expect(screen.getByTestId('type-mismatch-icon-成員姓名')).toBeInTheDocument()
    })

    // Click Info icon on column header
    const infoBtn = screen.getByTestId('col-info-btn-成員姓名')
    await act(async () => {
      fireEvent.click(infoBtn)
    })

    const popover = screen.getByTestId('col-sources-popover-成員姓名')
    expect(popover).toBeInTheDocument()
    expect(popover).toHaveTextContent('開發部')
    expect(popover).toHaveTextContent('行銷部')

    // Click unmerge button
    const unmergeBtn = screen.getByTestId('toggle-unmerge-btn-成員姓名')
    await act(async () => {
      fireEvent.click(unmergeBtn)
    })

    // Column should be split into table-specific columns
    await waitFor(() => {
      expect(screen.getByTestId('sort-header-field_101')).toBeInTheDocument()
      expect(screen.getByTestId('sort-header-field_205')).toBeInTheDocument()
    })
  })

  it('supports pinning columns and keeps pinned columns fixed', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Project A', Tag: 'Important' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('sort-header-Title')).toBeInTheDocument()
    })

    const pinBtn = screen.getByTestId('pin-col-Title')
    await act(async () => {
      fireEvent.click(pinBtn)
    })

    // Header should be sticky with stickyLeft
    const titleHeader = screen.getByTestId('sort-header-Title')
    expect(titleHeader.style.position).toBe('sticky')
  })

  it('allows reverting an override value back to source table original value', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Overridden Title' },
          _hasOverride: true,
          _overrideKeys: ['Title'],
          _originalData: { Title: 'Original SubTable Title' },
        },
      ],
      nextCursor: null,
    }

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, count: 1 }),
      })
    global.fetch = mockFetch as any

    render(<MasterGridView workspaceId={1} masterViewId={99} />)

    await waitFor(() => {
      expect(screen.getByText('Overridden Title')).toBeInTheDocument()
      expect(screen.getByTestId('override-badge')).toBeInTheDocument()
    })

    // Click override badge to open popover
    await act(async () => {
      fireEvent.click(screen.getByTestId('override-badge'))
    })

    expect(screen.getByTestId('override-popover')).toBeInTheDocument()
    expect(screen.getByText('Original SubTable Title')).toBeInTheDocument()

    // Click Revert button
    const revertBtn = screen.getByTestId('revert-override-btn')
    await act(async () => {
      fireEvent.click(revertBtn)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/workspaces/1/master-views/99/rows',
        expect.objectContaining({ method: 'DELETE' })
      )
      // Cell should optimistically restore original value
      expect(screen.getByText('Original SubTable Title')).toBeInTheDocument()
    })
  })

  it('renders CSV export button and triggers download', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date('2026-01-01').toISOString(),
          data: { Title: 'CSV Item 1', Price: 100 },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    // Mock URL.createObjectURL and click
    const mockCreateObjectURL = jest.fn().mockReturnValue('blob:mock-url')
    const mockRevokeObjectURL = jest.fn()
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL
    window.URL.createObjectURL = mockCreateObjectURL
    window.URL.revokeObjectURL = mockRevokeObjectURL

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('CSV Item 1')).toBeInTheDocument()
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
    })

    const exportBtn = screen.getByTestId('export-csv-btn')
    await act(async () => {
      fireEvent.click(exportBtn)
    })

    expect(mockCreateObjectURL).toHaveBeenCalled()
  })


  it('renders structured 3-step guide in empty state when no rows are available', async () => {
    const mockApiResponse = {
      rows: [],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('master-empty-state')).toBeInTheDocument()
      expect(screen.getByText('目前尚無跨表資料')).toBeInTheDocument()
      expect(screen.getByText('步驟 1')).toBeInTheDocument()
      expect(screen.getByText('步驟 2')).toBeInTheDocument()
      expect(screen.getByText('步驟 3')).toBeInTheDocument()
    })
  })

  it('opens FieldMappingModal and allows configuring synonym aliases', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { field_101: '台北張三' },
        },
        {
          id: 2,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { field_205: '高雄李四' },
        },
      ],
      fieldsMap: {
        field_101: { id: 101, tableId: 1, name: '姓名', type: 'text' },
        field_205: { id: 205, tableId: 2, name: '顧客姓名', type: 'text' }, // synonym
      },
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('台北張三')).toBeInTheDocument()
      expect(screen.getByTestId('toggle-columns-btn')).toBeInTheDocument()
    })

    // Open Integrated Hub
    const hubBtn = screen.getByTestId('toggle-columns-btn')
    await act(async () => {
      fireEvent.click(hubBtn)
    })

    // Open Field Mapping Modal from Hub
    const mappingBtn = screen.getByTestId('toggle-field-mapping-btn')
    await act(async () => {
      fireEvent.click(mappingBtn)
    })


    expect(screen.getByTestId('field-mapping-modal')).toBeInTheDocument()
    expect(screen.getByText('跨表欄位對照與合併確認')).toBeInTheDocument()

    // Map '顧客姓名' (field_205) to '姓名'
    const select = screen.getByTestId('merge-select-field_205')
    await act(async () => {
      fireEvent.change(select, { target: { value: '姓名' } })
    })

    // Apply mapping
    const applyBtn = screen.getByTestId('apply-mapping-btn')
    await act(async () => {
      fireEvent.click(applyBtn)
    })

    // Modal closes and columns are unified into "姓名"
    expect(screen.queryByTestId('field-mapping-modal')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByTestId('sort-header-姓名')).toBeInTheDocument()
    })
  })

  it('displays stale override badge when _isStaleOverride is true', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Old Master Override' },
          _hasOverride: true,
          _overrideKeys: ['Title'],
          _originalData: { Title: 'Modified SubTable Title' },
          _isStaleOverride: true,
          _overrideUpdatedAt: new Date('2026-01-01').toISOString(),
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Old Master Override')).toBeInTheDocument()
      expect(screen.getByText('覆寫 (來源已更新)')).toBeInTheDocument()
    })

    // Click stale override badge
    await act(async () => {
      fireEvent.click(screen.getByText('覆寫 (來源已更新)'))
    })

    expect(screen.getByTestId('override-popover')).toBeInTheDocument()
    expect(screen.getByText(/來源資料已被更新/)).toBeInTheDocument()
    expect(screen.getByText('Modified SubTable Title')).toBeInTheDocument()
  })

  it('opens excluded mismatch popover and lists rows excluded from calculation', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Amount: 100 },
        },
        {
          id: 102,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Amount: 'InvalidText' }, // string in numeric
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} tablesMap={{ 1: { name: '訂單表' } }} />)

    await waitFor(() => {
      expect(screen.getByTestId('excluded-mismatch-indicator-Amount')).toBeInTheDocument()
    })

    // Click excluded mismatch indicator button
    const indicatorBtn = screen.getByTestId('excluded-mismatch-indicator-Amount')
    await act(async () => {
      fireEvent.click(indicatorBtn)
    })

    // Popover opens
    const popover = screen.getByTestId('excluded-mismatch-popover-Amount')
    expect(popover).toBeInTheDocument()
    expect(popover).toHaveTextContent('因型別不符未計入計算')
    expect(popover).toHaveTextContent('訂單表 #102')
    expect(popover).toHaveTextContent('InvalidText')
  })

  it('renders quick table filter chips and filters rows when a table chip is selected', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Table 1 Item' },
        },
        {
          id: 201,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { Title: 'Table 2 Item' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{
          1: { name: '台北專案' },
          2: { name: '高雄專案' },
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('toggle-columns-btn')).toBeInTheDocument()
      expect(screen.getByText('Table 1 Item')).toBeInTheDocument()
      expect(screen.getByText('Table 2 Item')).toBeInTheDocument()
    })

    // Open Integrated Dimensions Panel
    const toggleBtn = screen.getByTestId('toggle-columns-btn')
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    expect(screen.getByTestId('master-columns-bar')).toBeInTheDocument()
    expect(screen.getByTestId('table-chip-all')).toBeInTheDocument()
    expect(screen.getByTestId('table-chip-1')).toBeInTheDocument()
    expect(screen.getByTestId('table-chip-2')).toBeInTheDocument()

    // Filter by Table 1 only
    const chip1 = screen.getByTestId('table-chip-1')
    await act(async () => {
      fireEvent.click(chip1)
    })


    expect(screen.getByText('Table 1 Item')).toBeInTheDocument()
    expect(screen.queryByText('Table 2 Item')).not.toBeInTheDocument()
    expect(screen.getByTestId('footer-count-cell')).toHaveTextContent('1/2 筆')

    // Click 'All' chip to reset
    const chipAll = screen.getByTestId('table-chip-all')
    await act(async () => {
      fireEvent.click(chipAll)
    })

    expect(screen.getByText('Table 1 Item')).toBeInTheDocument()
    expect(screen.getByText('Table 2 Item')).toBeInTheDocument()
    expect(screen.getByTestId('footer-count-cell')).toHaveTextContent('2 筆')
  })

  it('supports deep integration with hierarchical grouping, table focus, and smart column pruning', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'TP Item', TP_Specific: 'TP Val' },
        },
        {
          id: 2,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { Title: 'KH Item', KH_Specific: 'KH Val' },
        },
      ],
      fieldsMap: {
        field_1: { id: 1, tableId: 1, name: 'Title', type: 'text' },
        field_2: { id: 2, tableId: 2, name: 'Title', type: 'text' }, // shared
        field_3: { id: 3, tableId: 1, name: 'TP_Specific', type: 'text' }, // table 1 specific
        field_4: { id: 4, tableId: 2, name: 'KH_Specific', type: 'text' }, // table 2 specific
      },
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{
          1: { name: '台北專案' },
          2: { name: '高雄專案' },
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('TP Item')).toBeInTheDocument()
    })

    // Open Hub
    const toggleBtn = screen.getByTestId('toggle-columns-btn')
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    // Check hierarchical group headers
    expect(screen.getByText(/跨表通用欄位/)).toBeInTheDocument()
    expect(screen.getByText(/台北專案 專屬欄位/)).toBeInTheDocument()
    expect(screen.getByText(/高雄專案 專屬欄位/)).toBeInTheDocument()

    // Test Focus Table 1
    const focusBtn1 = screen.getByTestId('focus-table-btn-1')
    await act(async () => {
      fireEvent.click(focusBtn1)
    })

    expect(screen.getByText('TP Item')).toBeInTheDocument()
    expect(screen.queryByText('KH Item')).not.toBeInTheDocument()

    // Test Smart Column Pruning toggle
    const smartPruneBtn = screen.getByTestId('toggle-smart-prune-btn')
    await act(async () => {
      fireEvent.click(smartPruneBtn)
    })

    // Inactive group header should appear when Table 2 is not selected
    expect(screen.getByText(/未選取子表欄位/)).toBeInTheDocument()

    // Test Clear All Columns button
    const clearAllBtn = screen.getByTestId('clear-all-columns-btn')
    await act(async () => {
      fireEvent.click(clearAllBtn)
    })
    expect(screen.queryByTestId('sort-header-Title')).not.toBeInTheDocument()

    // Test Select All Columns button
    const selectAllBtn = screen.getByTestId('select-all-columns-btn')
    await act(async () => {
      fireEvent.click(selectAllBtn)
    })
    expect(screen.getByTestId('sort-header-Title')).toBeInTheDocument()
  })

  it('renders all complex field types cleanly without exposing raw JSON code or strings', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 501,
          tableId: 1,
          createdAt: '2026-08-17T10:00:00.000Z',
          data: {
            Title: '複雜欄位測試列',
            Tags: '["重要", "進行中"]',
            Assignee: '[{"id": 10, "username": "JeffreyChen"}]',
            RelatedTask: '[{"id": 20, "value": "核心功能開發"}]',
            Notes: '[{"id": "lc-1", "user": "Manager", "content": "請於下週前完成", "time": "2026-08-17 09:30"}]',
            Done: true,
            RatingScore: 4,
            DocLink: 'https://fycd.org',
            Contact: 'jeffrey@fycd.org',
            Attachment: '[{"name": "規格書.pdf", "url": "https://example.com/spec.pdf"}]',
          },
        },
      ],
      fieldsMap: {
        field_1: { id: 1, tableId: 1, name: 'Title', type: 'text' },
        field_2: { id: 2, tableId: 1, name: 'Tags', type: 'multiple_select', options: { choices: [{ id: '1', name: '重要', color: 'red' }, { id: '2', name: '進行中', color: 'blue' }] } },
        field_3: { id: 3, tableId: 1, name: 'Assignee', type: 'collaborator' },
        field_4: { id: 4, tableId: 1, name: 'RelatedTask', type: 'link_row' },
        field_5: { id: 5, tableId: 1, name: 'Notes', type: 'latest_comment' },
        field_6: { id: 6, tableId: 1, name: 'Done', type: 'boolean' },
        field_7: { id: 7, tableId: 1, name: 'RatingScore', type: 'rating' },
        field_8: { id: 8, tableId: 1, name: 'DocLink', type: 'url' },
        field_9: { id: 9, tableId: 1, name: 'Contact', type: 'email' },
        field_10: { id: 10, tableId: 1, name: 'Attachment', type: 'file' },
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{ 1: { name: '主力資料表', color: '#16a34a' } }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('複雜欄位測試列')).toBeInTheDocument()
    })

    // 1. Multiple Select badges rendered
    expect(screen.getByText('重要')).toBeInTheDocument()
    expect(screen.getByText('進行中')).toBeInTheDocument()

    // 2. Collaborator badge rendered
    expect(screen.getByText('JeffreyChen')).toBeInTheDocument()

    // 3. Link Row badge rendered
    expect(screen.getByText('核心功能開發')).toBeInTheDocument()

    // 4. Latest Comment text rendered
    expect(screen.getByText('請於下週前完成')).toBeInTheDocument()

    // 5. URL link rendered
    expect(screen.getByText('https://fycd.org')).toBeInTheDocument()

    // 6. Email link rendered
    expect(screen.getByText('jeffrey@fycd.org')).toBeInTheDocument()

    // 7. File attachment chip rendered
    expect(screen.getByText('規格書.pdf')).toBeInTheDocument()

    // 8. Crucial check: verify that NO raw JSON string is rendered in DOM!
    expect(screen.queryByText(/\[\{"id":/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\["重要"/)).not.toBeInTheDocument()
  })

  it('correctly resolves choice UUIDs across multiple tables without displaying raw UUID hash strings', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 601,
          tableId: 1,
          createdAt: '2026-08-17T10:00:00.000Z',
          data: {
            Title: '台北任務',
            Category: '["7eb0fcef-d4da-429a-a560-04a44f18bbde"]',
          },
        },
        {
          id: 602,
          tableId: 2,
          createdAt: '2026-08-17T10:05:00.000Z',
          data: {
            Title: '高雄任務',
            Category: '["b9ed6f56-c3e1-4630-be04-b4fbd727d408"]',
          },
        },
      ],
      fieldsMap: {
        field_101: {
          id: 101,
          tableId: 1,
          name: 'Title',
          type: 'text',
        },
        field_102: {
          id: 102,
          tableId: 1,
          name: 'Category',
          type: 'multiple_select',
          options: {
            choices: [{ id: '7eb0fcef-d4da-429a-a560-04a44f18bbde', name: '台北專案', color: 'green' }],
          },
        },
        field_201: {
          id: 201,
          tableId: 2,
          name: 'Title',
          type: 'text',
        },
        field_202: {
          id: 202,
          tableId: 2,
          name: 'Category',
          type: 'multiple_select',
          options: {
            choices: [{ id: 'b9ed6f56-c3e1-4630-be04-b4fbd727d408', name: '高雄專案', color: 'red' }],
          },
        },
      },
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{ 1: { name: '台北表' }, 2: { name: '高雄表' } }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('台北任務')).toBeInTheDocument()
      expect(screen.getByText('高雄任務')).toBeInTheDocument()
    })

    // Verify choice names are resolved from Table 1 and Table 2 options
    expect(screen.getByText('台北專案')).toBeInTheDocument()
    expect(screen.getByText('高雄專案')).toBeInTheDocument()

    // Verify NO raw UUID strings are displayed
    expect(screen.queryByText('7eb0fcef-d4da-429a-a560-04a44f18bbde')).not.toBeInTheDocument()
    expect(screen.queryByText('b9ed6f56-c3e1-4630-be04-b4fbd727d408')).not.toBeInTheDocument()
  })

  it('supports toggling Group by Table mode and collapsing/expanding table groups', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Task Alpha' },
        },
        {
          id: 202,
          tableId: 2,
          createdAt: new Date().toISOString(),
          data: { Title: 'Issue Beta' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(
      <MasterGridView
        workspaceId={1}
        tablesMap={{
          1: { name: 'Tasks Table', color: '#52A628' },
          2: { name: 'Issues Table', color: '#ea580c' },
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Task Alpha')).toBeInTheDocument()
      expect(screen.getByText('Issue Beta')).toBeInTheDocument()
    })

    // Click "依資料表分組" button
    const groupByTableBtn = screen.getByTestId('toggle-group-by-table-btn')
    fireEvent.click(groupByTableBtn)

    // Group headers should appear for both tables
    const countBadges = screen.getAllByText('(1 筆資料)')
    expect(countBadges).toHaveLength(2)

    // Click group header row for Tasks Table
    const groupHeaderRow = screen.getAllByText('Tasks Table')[0].closest('tr')!
    fireEvent.click(groupHeaderRow)

    // Task Alpha row under Table 1 should now be collapsed
    expect(screen.queryByText('Task Alpha')).not.toBeInTheDocument()
    // Issue Beta under Table 2 should still be visible
    expect(screen.getByText('Issue Beta')).toBeInTheDocument()

    // Click again to re-expand
    fireEvent.click(groupHeaderRow)
    expect(screen.getByText('Task Alpha')).toBeInTheDocument()
  })

  it('handles keyboard shortcut / to focus search input and Escape to close panels', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Shortcuts Test' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Shortcuts Test')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/搜尋已載入資料/)
    expect(document.activeElement).not.toBe(searchInput)

    // Press "/" key
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(searchInput)

    // Open Columns panel
    const columnsBtn = screen.getByTestId('toggle-columns-btn')
    fireEvent.click(columnsBtn)
    expect(screen.getByTestId('tab-fields-all')).toBeInTheDocument()

    // Press "Escape" key to close panel
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('tab-fields-all')).not.toBeInTheDocument()
  })

  it('supports row selection, select all, and renders bulk actions floating bar', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 1,
          tableId: 10,
          createdAt: new Date().toISOString(),
          data: { Title: 'Item One' },
        },
        {
          id: 2,
          tableId: 10,
          createdAt: new Date().toISOString(),
          data: { Title: 'Item Two' },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} masterViewId={99} />)

    await waitFor(() => {
      expect(screen.getByText('Item One')).toBeInTheDocument()
    })

    // Initially floating bulk bar is not shown
    expect(screen.queryByTestId('bulk-actions-floating-bar')).not.toBeInTheDocument()

    // Select row 1
    const row1Checkbox = screen.getByTestId('select-row-checkbox-10-1')
    fireEvent.click(row1Checkbox)

    // Floating bulk bar should appear with 1 selected
    expect(screen.getByTestId('bulk-actions-floating-bar')).toBeInTheDocument()
    expect(screen.getByText(/已選取 1 筆資料/)).toBeInTheDocument()
    expect(screen.getByTestId('bulk-export-csv-btn')).toBeInTheDocument()

    // Click select all
    const selectAllCheckbox = screen.getByTestId('select-all-rows-checkbox')
    fireEvent.click(selectAllCheckbox)
    expect(screen.getByText(/已選取 2 筆資料/)).toBeInTheDocument()

    // Click cancel selection
    const deselectBtn = screen.getByTestId('deselect-all-btn')
    fireEvent.click(deselectBtn)
    expect(screen.queryByTestId('bulk-actions-floating-bar')).not.toBeInTheDocument()
  })

  it('allows bulk reverting overrides on selected rows', async () => {
    const mockApiResponse = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Overridden 1' },
          _hasOverride: true,
          _overrideKeys: ['Title'],
          _originalData: { Title: 'Original 1' },
        },
        {
          id: 102,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Overridden 2' },
          _hasOverride: true,
          _overrideKeys: ['Title'],
          _originalData: { Title: 'Original 2' },
        },
      ],
      nextCursor: null,
    }

    const mockFetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, count: 1 }),
      })
    global.fetch = mockFetch as any

    render(<MasterGridView workspaceId={1} masterViewId={99} />)

    await waitFor(() => {
      expect(screen.getByText('Overridden 1')).toBeInTheDocument()
      expect(screen.getByText('Overridden 2')).toBeInTheDocument()
    })

    // Select all rows
    const selectAllCheckbox = screen.getByTestId('select-all-rows-checkbox')
    fireEvent.click(selectAllCheckbox)

    // Click bulk revert button
    const bulkRevertBtn = screen.getByTestId('bulk-revert-overrides-btn')
    await act(async () => {
      fireEvent.click(bulkRevertBtn)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/workspaces/1/master-views/99/rows',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({
            items: [
              { sourceTableId: 1, sourceRowId: 101 },
              { sourceTableId: 1, sourceRowId: 102 },
            ],
          }),
        })
      )
      // Cells should optimistically restore original values
      expect(screen.getByText('Original 1')).toBeInTheDocument()
      expect(screen.getByText('Original 2')).toBeInTheDocument()
    })
  })

  it('allows clearing search query with one-click clear button', async () => {
    const mockApiResponse = {
      meta: { totalCount: 2, hasOverrides: false, fields: {}, tables: {} },
      rows: [
        {
          id: 1,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Apple Task' },
          _hasOverride: false,
        },
        {
          id: 2,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { Title: 'Banana Task' },
          _hasOverride: false,
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Apple Task')).toBeInTheDocument()
      expect(screen.getByText('Banana Task')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/搜尋已載入資料/i)
    fireEvent.change(searchInput, { target: { value: 'Apple' } })

    expect(screen.getByText('Apple Task')).toBeInTheDocument()
    expect(screen.queryByText('Banana Task')).not.toBeInTheDocument()

    // Click clear button
    const clearBtn = screen.getByTestId('clear-search-btn')
    fireEvent.click(clearBtn)

    expect(searchInput).toHaveValue('')
    expect(screen.getByText('Apple Task')).toBeInTheDocument()
    expect(screen.getByText('Banana Task')).toBeInTheDocument()
  })

  it('reads unmergedKeys from localStorage on initial render', async () => {
    localStorage.setItem('master_unmerged_keys_1', JSON.stringify(['客戶名稱']))

    const mockApiResponse = {
      meta: {
        totalCount: 2,
        hasOverrides: false,
        fields: {
          field_1: { id: 1, tableId: 1, name: '客戶名稱', type: 'text' },
          field_2: { id: 2, tableId: 2, name: '客戶名稱', type: 'text' },
        },
        tables: {
          1: { name: '訂單 A' },
          2: { name: '訂單 B' },
        },
      },
      rows: [],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('master-grid-view')).toBeInTheDocument()
    })

    localStorage.removeItem('master_unmerged_keys_1')
  })

  it('searches inside nested objects and link row arrays in quick search', async () => {
    const mockApiResponse = {
      meta: {
        totalCount: 2,
        hasOverrides: false,
        fields: {
          field_1: { id: 1, tableId: 1, name: '關聯專案', type: 'link_row' },
        },
        tables: { 1: { name: '專案表' } },
      },
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { field_1: [{ id: 1, value: '台積電晶圓廠' }] },
        },
        {
          id: 102,
          tableId: 1,
          createdAt: new Date().toISOString(),
          data: { field_1: [{ id: 2, value: '聯發科晶片案' }] },
        },
      ],
      nextCursor: null,
    }

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any

    render(<MasterGridView workspaceId={1} />)

    await waitFor(() => {
      expect(screen.getByText('台積電晶圓廠')).toBeInTheDocument()
      expect(screen.getByText('聯發科晶片案')).toBeInTheDocument()
    })

    // Search for "台積電"
    const searchInput = screen.getByPlaceholderText(/搜尋已載入資料/)
    fireEvent.change(searchInput, { target: { value: '台積電' } })

    expect(screen.getByText('台積電晶圓廠')).toBeInTheDocument()
    expect(screen.queryByText('聯發科晶片案')).not.toBeInTheDocument()
  })
})









