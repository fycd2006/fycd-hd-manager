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

describe('AppSidebar 收合滑道', () => {
  it('展開狀態：寬度 250px 且導覽內容可見', () => {
    const { container } = render(
      <I18nProvider>
        <AppSidebar {...baseProps} isSidebarCollapsed={false} />
      </I18nProvider>
    )
    const root = getSidebarRoot(container)

    expect(root.style.width).toBe('250px')
    expect(screen.getByText(/Home|首頁/)).toBeVisible()
  })

  it('收合且未懸停：寬度 56px，只剩展開鈕，導覽內容隱藏', () => {
    const { container } = render(
      <I18nProvider>
        <AppSidebar {...baseProps} isSidebarCollapsed={true} />
      </I18nProvider>
    )
    const root = getSidebarRoot(container)

    expect(root.style.width).toBe('56px')
    expect(screen.getByRole('button', { name: /Expand Sidebar|展開側邊欄/ })).toBeVisible()
    expect(screen.getByText(/Home|首頁/)).not.toBeVisible()
  })

  it('收合時滑鼠移入會暫時展開成 250px，移出後收回 56px', () => {
    const { container } = render(
      <I18nProvider>
        <AppSidebar {...baseProps} isSidebarCollapsed={true} />
      </I18nProvider>
    )
    const root = getSidebarRoot(container)

    fireEvent.mouseEnter(root)
    expect(root.style.width).toBe('250px')
    expect(screen.getByText(/Home|首頁/)).toBeVisible()

    fireEvent.mouseLeave(root)
    expect(root.style.width).toBe('56px')
    expect(screen.getByText(/Home|首頁/)).not.toBeVisible()
  })

  it('展開狀態下懸停不影響寬度', () => {
    const { container } = render(
      <I18nProvider>
        <AppSidebar {...baseProps} isSidebarCollapsed={false} />
      </I18nProvider>
    )
    const root = getSidebarRoot(container)

    fireEvent.mouseLeave(root)
    expect(root.style.width).toBe('250px')
  })
})
