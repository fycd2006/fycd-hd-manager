/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
