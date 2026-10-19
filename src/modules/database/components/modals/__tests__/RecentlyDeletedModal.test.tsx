/** @jest-environment jsdom */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RecentlyDeletedModal } from '../RecentlyDeletedModal'
import { I18nProvider } from '@/lib/i18n/i18nContext'

jest.mock('lucide-react', () => new Proxy({}, {
  get: (_t, prop) => () => <span data-testid={`icon-${String(prop)}`} />,
}))

jest.mock('@/components/ui/Modal', () => {
  return function MockModal({ children, title, show }: { children: React.ReactNode; title?: string; show: boolean }) {
    if (!show) return null
    return (
      <div data-testid="mock-modal">
        <h2>{title}</h2>
        {children}
      </div>
    )
  }
})

const items = [
  { type: 'workspace', id: 1, name: '伙食團', parentName: null, deletedAt: '2026-10-01T00:00:00.000Z', daysLeft: 12 },
  { type: 'database', id: 2, name: '採購', parentName: '主廚坊', deletedAt: '2026-10-02T00:00:00.000Z', daysLeft: 5 },
  { type: 'table', id: 3, name: '菜單', parentName: '食材庫', deletedAt: '2026-10-03T00:00:00.000Z', daysLeft: 1 },
]

const jsonRes = (ok: boolean, body: unknown) => Promise.resolve({ ok, json: () => Promise.resolve(body) })

const setup = (fetchMock: jest.Mock) => {
  global.fetch = fetchMock as unknown as typeof fetch
  const onRestored = jest.fn()
  const onClose = jest.fn()
  render(
    <I18nProvider>
      <RecentlyDeletedModal open onClose={onClose} onRestored={onRestored} />
    </I18nProvider>
  )
  return { onRestored, onClose }
}

describe('RecentlyDeletedModal', () => {
  beforeEach(() => {
    document.cookie = 'i18n_locale=zh-TW'
  })

  it('lists items grouped by type with days left', async () => {
    setup(jest.fn(() => jsonRes(true, { items })))
    expect(await screen.findByText('伙食團')).toBeInTheDocument()
    expect(screen.getByText('採購')).toBeInTheDocument()
    expect(screen.getByText('菜單')).toBeInTheDocument()
    expect(screen.getByText('剩 12 天')).toBeInTheDocument()
    expect(screen.getByText('剩 5 天')).toBeInTheDocument()
    expect(screen.getByText('剩 1 天')).toBeInTheDocument()
    expect(screen.getByText('工作區')).toBeInTheDocument()
    expect(screen.getByText('資料庫')).toBeInTheDocument()
    expect(screen.getByText('資料表')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '還原' })).toHaveLength(3)
  })

  it('restores an item and calls onRestored', async () => {
    let listCalls = 0
    const fetchMock = jest.fn((url: string) => {
      if (url === '/api/trash/restore') return jsonRes(true, { message: '還原成功' })
      listCalls++
      return jsonRes(true, { items: listCalls === 1 ? items : items.slice(1) })
    })
    const { onRestored } = setup(fetchMock)
    await screen.findByText('伙食團')
    fireEvent.click(screen.getAllByRole('button', { name: '還原' })[0])
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/trash/restore', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'workspace', id: 1 }),
    }))
    await waitFor(() => expect(screen.queryByText('剩 12 天')).not.toBeInTheDocument())
  })

  it('shows the API error when restore is refused', async () => {
    const fetchMock = jest.fn((url: string) =>
      url === '/api/trash/restore' ? jsonRes(false, { error: '所屬工作區已被刪除，請先還原工作區' }) : jsonRes(true, { items })
    )
    const { onRestored } = setup(fetchMock)
    await screen.findByText('菜單')
    fireEvent.click(screen.getAllByRole('button', { name: '還原' })[2])
    expect(await screen.findByText('所屬工作區已被刪除，請先還原工作區')).toBeInTheDocument()
    expect(onRestored).not.toHaveBeenCalled()
  })

  it('shows the empty state', async () => {
    setup(jest.fn(() => jsonRes(true, { items: [] })))
    expect(await screen.findByText('沒有最近刪除的項目')).toBeInTheDocument()
  })
})
