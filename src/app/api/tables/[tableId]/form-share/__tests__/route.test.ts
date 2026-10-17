import { NextResponse } from 'next/server'
import { POST, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: { findFirst: jest.fn() },
    tableView: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  },
}))

const allow = () => ({ auth: { user: { id: 1 }, role: 'builder' } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })
const ctx = (tableId = '10') => ({ params: Promise.resolve({ tableId }) })
const share = (tableId = '10') => POST(new Request(`http://localhost/api/tables/${tableId}/form-share`, { method: 'POST' }), ctx(tableId))
const revoke = (tableId = '10') => DELETE(new Request(`http://localhost/api/tables/${tableId}/form-share`, { method: 'DELETE' }), ctx(tableId))

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
  ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 10 })
  ;(prisma.tableView.update as jest.Mock).mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }))
})

describe('POST /api/tables/[tableId]/form-share', () => {
  it('requires canManageViews on the table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await share()

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canManageViews' })
    expect(prisma.tableView.findFirst).not.toHaveBeenCalled()
  })

  it('reuses an existing token', async () => {
    ;(prisma.tableView.findFirst as jest.Mock).mockResolvedValue({ id: 8, shareToken: 'existing-token' })

    const res = await share()

    expect(await res.json()).toEqual({ token: 'existing-token', shareUrl: '/form/existing-token', viewId: 8 })
    expect(prisma.tableView.update).not.toHaveBeenCalled()
  })

  it('creates a form view and a random url-safe token when none exist', async () => {
    ;(prisma.tableView.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.tableView.create as jest.Mock).mockResolvedValue({ id: 9, shareToken: null })

    const res = await share()
    const body = await res.json()

    expect(prisma.tableView.create).toHaveBeenCalledWith({ data: { tableId: 10, name: '表單視圖', type: 'form' } })
    expect(body.token).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(prisma.tableView.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { shareToken: body.token } })
  })

  it('returns 404 for a deleted table and 400 for a bad id', async () => {
    ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await share()).status).toBe(404)
    expect(prisma.databaseTable.findFirst).toHaveBeenCalledWith({ where: { id: 10, deletedAt: null } })
    expect((await share('abc')).status).toBe(400)
  })
})

describe('DELETE /api/tables/[tableId]/form-share', () => {
  it('requires canManageViews on the table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await revoke()

    expect(res.status).toBe(403)
    expect(prisma.tableView.updateMany).not.toHaveBeenCalled()
  })

  it('clears share tokens of this table form views only', async () => {
    const res = await revoke()

    expect(res.status).toBe(200)
    expect(prisma.tableView.updateMany).toHaveBeenCalledWith({
      where: { tableId: 10, type: 'form', NOT: { shareToken: null } },
      data: { shareToken: null },
    })
  })
})
