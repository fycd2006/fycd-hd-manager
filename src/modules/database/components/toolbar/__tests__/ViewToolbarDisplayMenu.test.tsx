/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ViewToolbar } from '../ViewToolbar'
import type { RowHeight, FontScale } from '@/modules/database/types'

// Mock useI18n
jest.mock('@/lib/i18n/i18nContext', () => ({
  useI18n: () => ({
    locale: 'zh-TW',
    locales: [{ code: 'zh-TW', name: '繁體中文' }],
    t: (key: string) => {
      if (key === 'toolbar.rowHeight') return '列高'
      return key
    },
    language: 'zh-TW',
  }),
}))

jest.mock('@/modules/database/components/ai/AiAssistantModal', () => ({
  AiAssistantModal: () => null,
}))

jest.mock('motion/react', () => {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const MockMotionDiv = React.forwardRef<HTMLDivElement, any>(function MockMotionDiv({ children, ...props }, ref) {
    return <div ref={ref} {...props}>{children}</div>
  })
  return {
    motion: {
      div: MockMotionDiv,
    },
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    AnimatePresence: ({ children }: any) => <>{children}</>,
  }
})

describe('ViewToolbar - Display & Density Menu', () => {
  const defaultProps = {
    isSidebarCollapsed: false,
    setIsSidebarCollapsed: jest.fn(),
    views: [
      {
        id: 1,
        tableId: 10,
        name: 'Grid 1',
        type: 'grid' as const,
        filters: null,
        sortField: null,
        sortOrder: 'asc' as const,
        hiddenFields: null,
        columnWidths: null,
        rowColors: null,
        groupByField: null,
        aggregations: null,
        rowHeight: 'small',
      },
    ],
    activeViewId: 1,
    setActiveViewId: jest.fn(),
    applyViewConfig: jest.fn(),
    setShowNewViewModal: jest.fn(),
    saveViewConfig: jest.fn(),
    searchQuery: '',
    setSearchQuery: jest.fn(),
    sortField: null,
    setSortField: jest.fn(),
    sortOrder: 'asc' as const,
    setSortOrder: jest.fn(),
    filterRules: [],
    setFilterRules: jest.fn(),
    rowColorRules: [],
    setRowColorRules: jest.fn(),
    fields: [],
    hiddenFieldKeys: [],
    setHiddenFieldKeys: jest.fn(),
    rowHeight: 'small' as RowHeight,
    setRowHeight: jest.fn(),
    fontScale: 'standard' as FontScale,
    setFontScale: jest.fn(),
    handleExportCSV: jest.fn(),
    handleCSVImport: jest.fn(),
    csvInputRef: { current: null },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders row height and font scale options with correct labels when opened', () => {
    render(<ViewToolbar {...defaultProps} />)

    // Open row height menu
    const buttons = screen.getAllByText('列高')
    fireEvent.click(buttons[0])

    // Verify row height group
    const rowHeightGroup = screen.getByRole('group', { name: '列高' })
    expect(within(rowHeightGroup).getByText('小')).toBeInTheDocument()
    expect(within(rowHeightGroup).getByText('中')).toBeInTheDocument()
    expect(within(rowHeightGroup).getByText('大')).toBeInTheDocument()
    expect(within(rowHeightGroup).getByText('特大')).toBeInTheDocument()

    // Verify font scale section title and group
    expect(screen.getByText('字級')).toBeInTheDocument()
    const fontScaleGroup = screen.getByRole('group', { name: '字級' })
    expect(within(fontScaleGroup).getByText('標準')).toBeInTheDocument()
    expect(within(fontScaleGroup).getByText('大')).toBeInTheDocument()
    expect(within(fontScaleGroup).getByText('特大')).toBeInTheDocument()
  })

  it('calls setRowHeight with "large" and closes menu on row height click', () => {
    const setRowHeight = jest.fn()
    render(<ViewToolbar {...defaultProps} setRowHeight={setRowHeight} />)

    const buttons = screen.getAllByText('列高')
    fireEvent.click(buttons[0])

    const rowHeightGroup = screen.getByRole('group', { name: '列高' })
    const largeOption = within(rowHeightGroup).getByText('大')
    fireEvent.click(largeOption)

    expect(setRowHeight).toHaveBeenCalledWith('large')
    // After selection, menu should close
    expect(screen.queryByRole('group', { name: '列高' })).not.toBeInTheDocument()
  })

  it('calls setFontScale with "xlarge" and keeps menu open on font scale click', () => {
    const setFontScale = jest.fn()
    render(<ViewToolbar {...defaultProps} setFontScale={setFontScale} />)

    const buttons = screen.getAllByText('列高')
    fireEvent.click(buttons[0])

    const fontScaleGroup = screen.getByRole('group', { name: '字級' })
    const xlargeOption = within(fontScaleGroup).getByText('特大')
    fireEvent.click(xlargeOption)

    expect(setFontScale).toHaveBeenCalledWith('xlarge')
    // Menu should still be open
    expect(screen.getByRole('group', { name: '字級' })).toBeInTheDocument()
  })

  it('activates toolbar button style when rowHeight is not small or fontScale is not standard', () => {
    const { unmount } = render(
      <ViewToolbar {...defaultProps} rowHeight="medium" fontScale="standard" />
    )
    const activeLink = document.querySelector('.header__filter-link.active')
    expect(activeLink).toBeInTheDocument()
    unmount()

    render(
      <ViewToolbar {...defaultProps} rowHeight="small" fontScale="large" />
    )
    const activeLink2 = document.querySelector('.header__filter-link.active')
    expect(activeLink2).toBeInTheDocument()
  })

  it('does not crash and does not activate toolbar button when rowHeight and fontScale are undefined', () => {
    const propsWithoutDensity = {
      ...defaultProps,
      rowHeight: undefined,
      fontScale: undefined,
      setRowHeight: undefined,
      setFontScale: undefined,
    }

    render(<ViewToolbar {...propsWithoutDensity} />)
    const rowHeightBtn = screen.getAllByText('列高')[0].closest('.header__filter-link')
    expect(rowHeightBtn).not.toHaveClass('active')

    // Clicking options without callback should not throw
    const buttons = screen.getAllByText('列高')
    fireEvent.click(buttons[0])

    const rowHeightGroup = screen.getByRole('group', { name: '列高' })
    expect(() => {
      fireEvent.click(within(rowHeightGroup).getByText('大'))
    }).not.toThrow()
  })
})
