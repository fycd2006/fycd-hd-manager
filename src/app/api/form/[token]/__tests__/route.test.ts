import { NextResponse } from 'next/server'
import { GET, POST } from '../route'
import prisma from '@/lib/prisma'
import { createTableRow } from '@/modules/database/services/createRow'
import { applyRateLimit } from '@/lib/rate-limiter'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/modules/database/services/createRow', () => ({
  createTableRow: jest.fn(),
  FORM_READONLY_TYPES: ['formula', 'autonumber', 'created_time'],
}))

jest.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableView: { findFirst: jest.fn() },
    databaseTable: { findFirst: jest.fn() },
    tableField: { findMany: jest.fn() },
  },
}))

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'
const ctx = (token = TOKEN) => ({ params: Promise.resolve({ token }) })
const submit = (body: unknown, token = TOKEN) =>
  POST(new Request(`http://localhost/api/form/${token}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), ctx(token))

beforeEach(() => {
  jest.clearAllMocks()
  ;(applyRateLimit as jest.Mock).mockResolvedValue(null)
  ;(prisma.tableView.findFirst as jest.Mock).mockResolvedValue({ id: 8, tableId: 10, name: '報名表' })
  ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 10, name: '報名' })
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
    { id: 1, name: '姓名', type: 'text', options: null, order: 0, isIndexed: true },
    { id: 2, name: '編號', type: 'autonumber', options: null, order: 1 },
    { id: 3, name: '總計', type: 'formula', options: { formula: '1' }, order: 2 },
  ])
  ;(createTableRow as jest.Mock).mockResolvedValue({ ok: true, row: { id: 77 } })
})

describe('GET /api/form/[token]', () => {
  it('returns only writable fields without row data or internals', async () => {
    const res = await GET(new Request('http://localhost'), ctx())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      tableName: '報名',
      viewName: '報名表',
      fields: [{ id: 1, name: '姓名', type: 'text', options: null, order: 0 }],
    })
    expect(prisma.tableView.findFirst).toHaveBeenCalledWith({ where: { shareToken: TOKEN, type: 'form' } })
  })

  it('rejects malformed tokens without querying the database', async () => {
    const res = await GET(new Request('http://localhost'), ctx('short'))

    expect(res.status).toBe(404)
    expect(prisma.tableView.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown token or a deleted table', async () => {
    ;(prisma.tableView.findFirst as jest.Mock).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx())).status).toBe(404)

    ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValueOnce(null)
    expect((await GET(new Request('http://localhost'), ctx())).status).toBe(404)
    expect(prisma.databaseTable.findFirst).toHaveBeenLastCalledWith({ where: { id: 10, deletedAt: null } })
  })
})

describe('POST /api/form/[token]', () => {
  it('creates a row through the shared create path with a read-only field filter', async () => {
    const res = await submit({ data: { '1': '小明' } })

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ message: '提交成功' })
    const args = (createTableRow as jest.Mock).mock.calls[0][0]
    expect(args).toMatchObject({ tableId: 10, input: { '1': '小明' }, username: '表單提交 (Form)', canAddOptions: false })
    expect(args.fieldFilter({ type: 'text' })).toBe(true)
    expect(args.fieldFilter({ type: 'formula' })).toBe(false)
    expect(triggerTableEvent).toHaveBeenCalledWith(10, 'row-created', { row: { id: 77 } })
  })

  it('treats a missing data object as an empty submission', async () => {
    await submit({ nope: 1 })

    expect(createTableRow).toHaveBeenCalledWith(expect.objectContaining({ input: {} }))
  })

  it('returns 400 for invalid JSON', async () => {
    const res = await submit('{not json')

    expect(res.status).toBe(400)
    expect(createTableRow).not.toHaveBeenCalled()
  })

  it('returns 400 with the validation error from createTableRow', async () => {
    ;(createTableRow as jest.Mock).mockResolvedValue({ ok: false, error: '姓名為必填' })

    const res = await submit({ data: {} })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '姓名為必填' })
    expect(triggerTableEvent).not.toHaveBeenCalled()
  })

  it('is rate limited per IP before looking up the form', async () => {
    ;(applyRateLimit as jest.Mock).mockResolvedValue(NextResponse.json({ error: 'slow down' }, { status: 429 }))

    const res = await submit({ data: {} })

    expect(res.status).toBe(429)
    expect(applyRateLimit).toHaveBeenCalledWith('form:127.0.0.1', 10, 60)
    expect(prisma.tableView.findFirst).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown token', async () => {
    ;(prisma.tableView.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await submit({ data: {} })

    expect(res.status).toBe(404)
    expect(createTableRow).not.toHaveBeenCalled()
  })
})
