/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import WorkspaceDashboard from '../WorkspaceDashboard'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import type { Database, Workspace } from '@/modules/database/types'

jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: function (target, prop) {
      if (prop === '__esModule') return false
      return () => <span data-testid={`icon-${String(prop)}`} />
    }
  })
})

jest.mock('@/modules/database/components/navigation/LangPicker', () => ({
  LangPicker: () => null,
}))

jest.mock('@/components/animate-ui/primitives/texts/sliding-number', () => ({
  SlidingNumber: ({ number }: { number: number }) => <span>{number}</span>,
}))

jest.mock('@/modules/database/components/views/master', () => ({
  MasterGridView: () => <div data-testid="master-grid" />,
}))

// jsdom 沒有 PointerEvent，補一個會帶 pointerType 的最小版本
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerType: string
    constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? ''
    }
  }
  ;(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill
}

type Props = React.ComponentProps<typeof WorkspaceDashboard>

function makeDatabase(id: number, name: string, tableCount: number): Database {
  return {
    id,
    name,
    workspaceId: 1,
    tables: Array.from({ length: tableCount }, (_, idx) => ({
      id: id * 100 + idx + 1,
      name: `表${idx + 1}`,
      order: idx,
      databaseId: id,
    })),
  }
}

const workspace: Workspace = {
  id: 1,
  name: '伙食團',
  databases: [makeDatabase(1, '庫A', 2), makeDatabase(2, '庫B', 1)],
  members: [{ userId: 1, role: 'admin' }],
}

function renderDashboard(overrides: Partial<Props> = {}) {
  const props: Props = {
    currentUser: { id: 1, username: 'jeff', email: 'jeff@example.com', role: 'admin' },
    activeWorkspace: workspace,
    workspaces: [workspace],
    onSelectTable: jest.fn(),
    ...overrides,
  }
  return render(
    <I18nProvider>
      <WorkspaceDashboard {...props} />
    </I18nProvider>
  )
}

const ws7 = (): Workspace => ({ ...workspace, databases: [makeDatabase(1, '庫A', 7), makeDatabase(2, '庫B', 5)] })
const SEARCH = '搜尋資料庫或資料表...'

beforeEach(() => {
  // jsdom 的 navigator.language 是 en-US，固定用繁中驗證文案
  localStorage.setItem('fycd_i18n_locale', 'zh-TW')
})

describe('WorkspaceDashboard i18n', () => {
  it('指標卡標籤走 i18n', () => {
    renderDashboard()
    expect(screen.getByText('資料庫數')).toBeInTheDocument()
    expect(screen.getByText('資料表數')).toBeInTheDocument()
    expect(screen.queryByText('DATABASE COUNT')).not.toBeInTheDocument()
    expect(screen.queryByText('dashboard.description')).not.toBeInTheDocument()
  })

  it('歡迎列用 welcomeLine', () => {
    renderDashboard()
    expect(screen.getByText('歡迎回來，jeff · 管理者')).toBeInTheDocument()
  })

  it('跨表總表可進入與返回', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /跨表總表/ }))
    expect(screen.getByTestId('master-grid')).toBeInTheDocument()
    expect(screen.getByText(`${workspace.name} · 跨表總表`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回工作區總覽' }))
    expect(screen.queryByTestId('master-grid')).not.toBeInTheDocument()
  })

  it('空工作區的範本按鈕帶正確 key', () => {
    const onCreateFromTemplate = jest.fn()
    renderDashboard({ activeWorkspace: { ...workspace, databases: [] }, onShowDatabaseModal: jest.fn(), onCreateFromTemplate })
    ;[['專案範本', 'project'], ['CRM 範本', 'crm'], ['財務範本', 'finance'], ['人資範本', 'hr']].forEach(([label, key]) => {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(onCreateFromTemplate).toHaveBeenLastCalledWith(key)
    })
  })

  it('activeWorkspace 為 null 時用後備標題且不顯示工作區按鈕', () => {
    renderDashboard({ activeWorkspace: null, onShowDatabaseModal: jest.fn() })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('雲端工作區')
    expect(screen.queryByRole('button', { name: /跨表總表/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /新增資料庫/ })).not.toBeInTheDocument()
  })

  it('暗色模式字標改用 onDark tone，淺色維持 brand', () => {
    const { container, unmount } = renderDashboard({ theme: 'dark' })
    expect(container.querySelector('[data-tone="onDark"]')).toBeInTheDocument()
    unmount()
    const light = renderDashboard()
    expect(light.container.querySelector('[data-tone="brand"]')).toBeInTheDocument()
  })
})

describe('WorkspaceDashboard 資料表列', () => {
  it('資料表列是按鈕，點擊開啟資料表', () => {
    const onSelectTable = jest.fn()
    renderDashboard({ onSelectTable })
    // 庫A、庫B 都有「表1」，第一個是庫A 的（id 101）
    fireEvent.click(screen.getAllByRole('button', { name: '表1' })[0])
    expect(onSelectTable).toHaveBeenCalledWith(101)
  })

  it('鉛筆按鈕只觸發重新命名', () => {
    const onSelectTable = jest.fn()
    const onShowRenameModal = jest.fn()
    const onSetRenameId = jest.fn()
    renderDashboard({ onSelectTable, onShowRenameModal, onSetRenameId, onSetRenameType: jest.fn(), onSetRenameNameValue: jest.fn() })
    fireEvent.click(screen.getAllByRole('button', { name: '重新命名資料表 - 表1' })[0])
    expect(onSetRenameId).toHaveBeenCalledWith(101)
    expect(onShowRenameModal).toHaveBeenCalled()
    expect(onSelectTable).not.toHaveBeenCalled()
  })

  it('沒有巢狀按鈕（含展開按鈕）', () => {
    const { container } = renderDashboard({ activeWorkspace: ws7(), onShowRenameModal: jest.fn() })
    expect(container.querySelectorAll('button button')).toHaveLength(0)
  })

  it('沒有巢狀按鈕', () => {
    const { container } = renderDashboard({ onShowRenameModal: jest.fn() })
    expect(container.querySelectorAll('button button')).toHaveLength(0)
  })
})

describe('WorkspaceDashboard 資料表預覽上限', () => {
  it('超過 5 張只顯示前 5 張，可展開與收合', () => {
    renderDashboard({ activeWorkspace: ws7() })
    expect(screen.queryByRole('button', { name: '表6' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '顯示全部（7）' }))
    expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '收合' }))
    expect(screen.queryByRole('button', { name: '表6' })).not.toBeInTheDocument()
  })

  it('剛好 5 張不顯示展開按鈕', () => {
    renderDashboard({ activeWorkspace: { ...workspace, databases: [makeDatabase(2, '庫B', 5)] } })
    expect(screen.queryByRole('button', { name: /顯示全部/ })).not.toBeInTheDocument()
  })

  it('搜尋資料表時不套用上限', () => {
    renderDashboard({ activeWorkspace: ws7() })
    fireEvent.change(screen.getByPlaceholderText(SEARCH), { target: { value: '表' } })
    expect(screen.getAllByRole('button', { name: '表7' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /顯示全部/ })).not.toBeInTheDocument()
  })

  it('搜尋符合資料庫名稱時顯示該庫全部資料表', () => {
    renderDashboard({ activeWorkspace: ws7() })
    fireEvent.change(screen.getByPlaceholderText(SEARCH), { target: { value: '庫A' } })
    expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
  })

  it('展開後搜尋再清空，保留展開狀態', () => {
    renderDashboard({ activeWorkspace: ws7() })
    fireEvent.click(screen.getByRole('button', { name: '顯示全部（7）' }))
    const input = screen.getByPlaceholderText(SEARCH)
    fireEvent.change(input, { target: { value: '表1' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByRole('button', { name: '表7' })).toBeInTheDocument()
  })
})

describe('WorkspaceDashboard 樣式', () => {
  const HARDCODED_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(/i
  const coloredInline = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>('[style]')).filter(el => HARDCODED_COLOR.test(el.getAttribute('style') ?? ''))

  it('元件內沒有寫死色碼的 inline style', () => {
    const { container } = renderDashboard({ activeWorkspace: ws7(), onShowRenameModal: jest.fn(), onShowMembersModal: jest.fn(), onShowDatabaseModal: jest.fn(), onShowCreateTableModal: jest.fn() })
    expect(coloredInline(container)).toHaveLength(0)
  })

  it('空狀態同樣沒有寫死色碼', () => {
    const { container } = renderDashboard({ activeWorkspace: { ...workspace, databases: [] }, onShowDatabaseModal: jest.fn(), onCreateFromTemplate: jest.fn() })
    expect(coloredInline(container)).toHaveLength(0)
  })

  it('跨表總表返回列沒有寫死色碼', () => {
    const { container } = renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: /跨表總表/ }))
    expect(coloredInline(container)).toHaveLength(0)
  })
})

describe('WorkspaceDashboard prefetch', () => {
  it('prefetches table on hover', () => {
    jest.useFakeTimers()
    try {
      const onTablePrefetch = jest.fn()
      renderDashboard({ onTablePrefetch })
      const btn = screen.getAllByText('表1')[0].closest('button') as HTMLElement
      fireEvent.pointerEnter(btn, { pointerType: 'mouse' })
      act(() => { jest.advanceTimersByTime(120) })
      expect(onTablePrefetch).toHaveBeenCalledWith(101)
    } finally {
      jest.useRealTimers()
    }
  })
})
