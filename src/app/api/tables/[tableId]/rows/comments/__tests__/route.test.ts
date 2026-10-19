import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

const tx = {
  tableRow: { findFirst: jest.fn() },
  rowComment: { create: jest.fn() },
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    rowComment: { findMany: jest.fn() },
    tableRow: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const allow = () => ({ auth: { user: { id: 2, username: 'bob' }, role: 'commenter' } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })
const ctx = (tableId = '10') => ({ params: Promise.resolve({ tableId }) })
const list = (query: string, tableId = '10') =>
  GET(new Request(`http://localhost/api/tables/${tableId}/rows/comments${query}`), ctx(tableId))
const post = (body: unknown) =>
  POST(new Request('http://localhost/api/tables/10/rows/comments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), ctx())

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
  ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([])
  ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  tx.tableRow.findFirst.mockResolvedValue({ id: 30 })
  tx.rowComment.create.mockImplementation(async ({ data }) => ({ id: 1, ...data }))
})

describe('GET /api/tables/[tableId]/rows/comments', () => {
  it('requires canComment on the table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await list('?rowId=30')

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canComment' })
    expect(prisma.rowComment.findMany).not.toHaveBeenCalled()
  })

  it('prepends a synthetic creation entry when the row has no history comments', async () => {
    const createdAt = new Date('2026-02-01T00:00:00Z')
    ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([{ id: 5, content: 'hi' }])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ createdAt, updatedAt: createdAt })

    const body = await (await list('?rowId=30')).json()

    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ id: -999, rowId: 30, content: '[HISTORY] 建立了此資料列', createdAt: createdAt.toISOString() })
    expect(body[1]).toEqual({ id: 5, content: 'hi' })
  })

  it('returns comments as-is when history entries already exist', async () => {
    ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([{ id: 5, content: '[HISTORY] 修改了欄位' }])

    const body = await (await list('?rowId=30')).json()

    expect(body).toEqual([{ id: 5, content: '[HISTORY] 修改了欄位' }])
    // the row lookup always runs now: it scopes rowId to the authorized table (see route.scope.test.ts)
    expect(prisma.tableRow.findFirst).toHaveBeenCalledWith({ where: { id: 30, tableId: 10 }, select: { createdAt: true, updatedAt: true } })
  })

  it('GET labels comments of deleted users as 已刪除的使用者', async () => {
    ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([
      { id: 5, content: 'hi', user: null },
      { id: 6, content: 'yo', user: { username: 'bob', role: 'editor' } },
    ])

    const body = await (await list('?rowId=30')).json()

    expect(body[0]).toMatchObject({ id: -999, user: { username: '系統 (System)' } })
    expect(body[1]).toEqual({ id: 5, content: 'hi', user: { username: '已刪除的使用者', role: null } })
    expect(body[2].user).toEqual({ username: 'bob', role: 'editor' })
  })

  it('GET labels deleted-user comments when history entries already exist', async () => {
    ;(prisma.rowComment.findMany as jest.Mock).mockResolvedValue([
      { id: 5, content: '[HISTORY] 修改了欄位', user: null },
    ])

    const body = await (await list('?rowId=30')).json()

    expect(body[0].user).toEqual({ username: '已刪除的使用者', role: null })
  })

  it('returns 400 for a missing or invalid rowId', async () => {
    expect((await list('')).status).toBe(400)
    expect((await list('?rowId=abc')).status).toBe(400)
    expect((await list('?rowId=1', 'abc')).status).toBe(400)
  })
})

describe('POST /api/tables/[tableId]/rows/comments', () => {
  it('requires canComment on the table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(deny())

    const res = await post({ rowId: 30, content: 'hi' })

    expect(res.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('creates a trimmed comment only on a live row of this table', async () => {
    const res = await post({ rowId: '30', content: '  好吃  ' })

    expect(res.status).toBe(201)
    expect(tx.tableRow.findFirst).toHaveBeenCalledWith({ where: { id: 30, tableId: 10, deletedAt: null }, select: { id: true } })
    expect(tx.rowComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { rowId: 30, userId: 2, content: '好吃' },
    }))
  })

  it('returns 404 when the row is not in this table or is deleted', async () => {
    tx.tableRow.findFirst.mockResolvedValue(null)

    const res = await post({ rowId: 999, content: 'hi' })

    expect(res.status).toBe(404)
    expect(tx.rowComment.create).not.toHaveBeenCalled()
  })

  it('returns 400 for empty content, missing row or invalid JSON', async () => {
    expect((await post({ rowId: 30, content: '   ' })).status).toBe(400)
    expect((await post({ content: 'hi' })).status).toBe(400)
    expect((await post({ rowId: 'x', content: 'hi' })).status).toBe(400)
    expect((await post('{bad')).status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
