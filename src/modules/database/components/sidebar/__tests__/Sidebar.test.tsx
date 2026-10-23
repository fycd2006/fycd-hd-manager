/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppSidebar from '../Sidebar'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import type { Workspace, User } from '@/modules/database/types'

jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: function (target, prop) {
      if (prop === '__esModule') return false
      return () => <span data-testid={`icon-${String(prop)}`} />
    }
  })
})

jest.mock('@/components/animate-ui/icons', () => {
  return new Proxy({}, {
    get: function (target, prop) {
      if (prop === '__esModule') return false
      return () => <span data-testid={`icon-${String(prop)}`} />
    }
  })
})

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

const workspace: Workspace = {
  id: 1,
  name: '伙食團',
  databases: [{
    id: 1,
    name: '庫A',
    workspaceId: 1,
    tables: [{ id: 101, name: '菜單表', order: 0, databaseId: 1 }],
  }],
  members: [{ userId: 1, role: 'admin' }],
}

const baseProps = {
  currentUser: { id: 1, username: 'tester', email: 'tester@example.com', role: 'admin' } as User,
  workspaces: [workspace],
  activeWorkspaceId: 1,
  activeTableId: null,
  collapsedDatabases: {},
  theme: 'light' as const,
  onToggleTheme: jest.fn(),
  onLogout: jest.fn(),
  onToggleDatabaseCollapse: jest.fn(),
  onSetActiveWorkspaceId: jest.fn(),
  onSetActiveTableId: jest.fn(),
  onShowWorkspaceModal: jest.fn(),
  onShowDatabaseModal: jest.fn(),
  onSetRenameType: jest.fn(),
  onSetRenameId: jest.fn(),
  onSetRenameNameValue: jest.fn(),
  onShowRenameModal: jest.fn(),
  onDeleteWorkspaceOrDb: jest.fn(),
  onToggleDarkReaderPanel: jest.fn(),
}

function getSidebarRoot(container: HTMLElement) {
  const root = container.querySelector('.layout__col-1') as HTMLElement
  expect(root).not.toBeNull()
  return root
}

describe('Sidebar prefetch', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false, media: query, onchange: null,
        addEventListener: jest.fn(), removeEventListener: jest.fn(),
        addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
      }),
    })
  })

  it('prefetches table on hover', () => {
    jest.useFakeTimers()
    try {
      const onTablePrefetch = jest.fn()
      render(
        <I18nProvider>
          <AppSidebar
            {...baseProps}
            onTablePrefetch={onTablePrefetch}
          />
        </I18nProvider>
      )
      const item = screen.getByText('菜單表').closest('a') as HTMLElement
      fireEvent.pointerEnter(item, { pointerType: 'mouse' })
      act(() => { jest.advanceTimersByTime(120) })
      expect(onTablePrefetch).toHaveBeenCalledWith(101)
    } finally {
      jest.useRealTimers()
    }
  })
})


function renderSidebar(props: Partial<React.ComponentProps<typeof AppSidebar>> = {}) {
  const utils = render(
    <I18nProvider>
      <AppSidebar {...baseProps} {...props} />
    </I18nProvider>
  )
  const root = getSidebarRoot(utils.container)
  const panel = root.querySelector('[data-sidebar-panel]') as HTMLElement
  expect(panel).not.toBeNull()
  return { ...utils, root, panel }
}

const EXPAND_LABEL = /Expand Sidebar|展開側邊欄/
const COLLAPSE_LABEL = /Collapse Sidebar|收合側邊欄/
const HOME_LABEL = /Home|首頁/

describe('AppSidebar 收合／懸停浮出（Claude 風格）', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('固定展開：佔 250px，導覽可操作，收合鈕在面板內', () => {
    const { root, panel } = renderSidebar({ isSidebarCollapsed: false })

    expect(root).toHaveAttribute('data-sidebar-mode', 'docked')
    expect(root.style.width).toBe('250px')
    expect(panel).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: HOME_LABEL })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COLLAPSE_LABEL })).toBeInTheDocument()
  })

  it('收合：不佔版面寬度，畫面上只剩一顆展開鈕，面板不可操作', () => {
    const { root, panel } = renderSidebar({ isSidebarCollapsed: true })

    expect(root).toHaveAttribute('data-sidebar-mode', 'collapsed')
    expect(root.style.width).toBe('0px')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
    expect(panel).toHaveAttribute('inert')
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName(EXPAND_LABEL)
  })

  it('滑鼠碰到展開鈕才浮出側邊欄，且不推擠內容寬度', () => {
    const { root, panel } = renderSidebar({ isSidebarCollapsed: true })

    const initialButton = screen.getByRole('button', { name: EXPAND_LABEL })
    fireEvent.mouseEnter(initialButton)

    expect(root).toHaveAttribute('data-sidebar-mode', 'peek')
    expect(root.style.width).toBe('0px')
    expect(panel).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('button', { name: HOME_LABEL })).toBeInTheDocument()

    // 浮出時，面板內的切換鈕 aria-expanded 為 true，外部按鈕退出無障礙樹
    const panelToggle = panel.querySelector('[data-sidebar-toggle]') as HTMLElement
    expect(panelToggle).toHaveAttribute('aria-expanded', 'true')
    const allAccessibleExpandButtons = screen.getAllByRole('button', { name: EXPAND_LABEL })
    expect(allAccessibleExpandButtons).toHaveLength(1)
    expect(allAccessibleExpandButtons[0]).toBe(panelToggle)
  })

  it('離開浮出的側邊欄後短暫延遲再收回；延遲內移回則保持展開', () => {
    const { root, panel } = renderSidebar({ isSidebarCollapsed: true })
    fireEvent.mouseEnter(screen.getByRole('button', { name: EXPAND_LABEL }))
    fireEvent.mouseEnter(panel)

    fireEvent.mouseLeave(panel)
    act(() => { jest.advanceTimersByTime(100) })
    expect(root).toHaveAttribute('data-sidebar-mode', 'peek')

    fireEvent.mouseEnter(panel)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(root).toHaveAttribute('data-sidebar-mode', 'peek')

    fireEvent.mouseLeave(panel)
    act(() => { jest.advanceTimersByTime(400) })
    expect(root).toHaveAttribute('data-sidebar-mode', 'collapsed')
    expect(panel).toHaveAttribute('aria-hidden', 'true')
  })

  it('浮出時打開側邊欄內的下拉選單，滑鼠移到選單上不會收回；選單關閉後才收回', () => {
    const { root, panel } = renderSidebar({ isSidebarCollapsed: true })
    fireEvent.mouseEnter(screen.getByRole('button', { name: EXPAND_LABEL }))
    fireEvent.mouseEnter(panel)

    const workspaceTrigger = screen.getByText('伙食團').closest('button') as HTMLElement
    fireEvent.pointerDown(workspaceTrigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.mouseLeave(panel)
    act(() => { jest.advanceTimersByTime(1000) })
    expect(root).toHaveAttribute('data-sidebar-mode', 'peek')

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    act(() => { jest.advanceTimersByTime(1000) })
    expect(root).toHaveAttribute('data-sidebar-mode', 'collapsed')
  })

  it('浮出時按 Escape 立即收回', () => {
    const { root } = renderSidebar({ isSidebarCollapsed: true })
    fireEvent.mouseEnter(screen.getByRole('button', { name: EXPAND_LABEL }))

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(root).toHaveAttribute('data-sidebar-mode', 'collapsed')
  })

  it('浮出時點面板內的切換鈕會固定展開側邊欄', () => {
    const onToggleSidebarCollapse = jest.fn()
    const { panel } = renderSidebar({ isSidebarCollapsed: true, onToggleSidebarCollapse })
    fireEvent.mouseEnter(screen.getByRole('button', { name: EXPAND_LABEL }))

    const panelToggle = panel.querySelector('[data-sidebar-toggle]') as HTMLElement
    expect(panelToggle).toHaveAccessibleName(EXPAND_LABEL)
    fireEvent.click(panelToggle)
    expect(onToggleSidebarCollapse).toHaveBeenCalledTimes(1)
  })

  it('點收合鈕後游標仍停在原處，不會立刻又浮出；移開再碰到才浮出', () => {
    const onToggleSidebarCollapse = jest.fn()
    const { root, rerender } = renderSidebar({ isSidebarCollapsed: false, onToggleSidebarCollapse })

    // 滑鼠點擊的 detail ≥ 1（鍵盤觸發為 0）
    fireEvent.click(screen.getByRole('button', { name: COLLAPSE_LABEL }), { detail: 1 })
    expect(onToggleSidebarCollapse).toHaveBeenCalledTimes(1)
    rerender(
      <I18nProvider>
        <AppSidebar {...baseProps} isSidebarCollapsed={true} onToggleSidebarCollapse={onToggleSidebarCollapse} />
      </I18nProvider>
    )

    const floatingToggle = screen.getByRole('button', { name: EXPAND_LABEL })
    fireEvent.mouseEnter(floatingToggle)
    expect(root).toHaveAttribute('data-sidebar-mode', 'collapsed')

    fireEvent.mouseLeave(floatingToggle)
    fireEvent.mouseEnter(floatingToggle)
    expect(root).toHaveAttribute('data-sidebar-mode', 'peek')
  })

  it('Ctrl+B 切換收合', () => {
    const onToggleSidebarCollapse = jest.fn()
    renderSidebar({ isSidebarCollapsed: false, onToggleSidebarCollapse })

    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(onToggleSidebarCollapse).toHaveBeenCalledTimes(1)
  })
})
