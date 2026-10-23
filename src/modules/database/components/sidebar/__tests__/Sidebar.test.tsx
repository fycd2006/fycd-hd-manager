/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import AppSidebar from '../Sidebar'
import { I18nProvider } from '@/lib/i18n/i18nContext'
import type { Workspace } from '@/modules/database/types'

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
            currentUser={{ id: 1, username: 'jeff', email: 'jeff@example.com', role: 'admin' }}
            workspaces={[workspace]}
            activeWorkspaceId={1}
            activeTableId={null}
            collapsedDatabases={{}}
            theme="light"
            onTablePrefetch={onTablePrefetch}
            onToggleTheme={jest.fn()}
            onLogout={jest.fn()}
            onToggleDatabaseCollapse={jest.fn()}
            onSetActiveWorkspaceId={jest.fn()}
            onSetActiveTableId={jest.fn()}
            onShowWorkspaceModal={jest.fn()}
            onShowDatabaseModal={jest.fn()}
            onSetRenameType={jest.fn()}
            onSetRenameId={jest.fn()}
            onSetRenameNameValue={jest.fn()}
            onShowRenameModal={jest.fn()}
            onDeleteWorkspaceOrDb={jest.fn()}
            onToggleDarkReaderPanel={jest.fn()}
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
