import { PATCH as singlePatch } from '../route'
import { PATCH as batchPatch } from '../batch/route'
import { POST as move } from '../move/route'
import { createTableRow } from '@/modules/database/services/createRow'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({ getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice' }) }))
jest.mock('@/lib/authorize', () => ({ authorizeAction: jest.fn() }))
jest.mock('@/lib/pusher-server', () => ({ triggerTableEvent: jest.fn() }))
jest.mock('@/modules/database/services/linkRowSync', () => ({
  syncBiDirectionalLinkRow: jest.fn().mockResolvedValue(null),
  cleanupRowLinkRowRelations: jest.fn().mockResolvedValue(undefined),
  parseLinkRowIds: jest.requireActual('@/modules/database/services/linkRowSync').parseLinkRowIds,
}))
jest.mock('@/modules/database/services/rowCascade', () => ({
  cascadeRecomputeSingleLevel: jest.fn().mockResolvedValue([]),
}))
jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCache: jest.fn().mockResolvedValue(undefined),
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), createMany: jest.fn(), create: jest.fn(), aggregate: jest.fn() },
  tableField: { findFirst: jest.fn(), update: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    tableField: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    tableRow: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), aggregate: jest.fn(), deleteMany: jest.fn(), update: jest.fn() },
    moveOperationLog: { create: jest.fn() },
  },
}))

const fields = [
  { id: 1, tableId: 10, name: '名稱', type: 'text', options: null },
  { id: 2, tableId: 10, name: '數量', type: 'number', options: null },
  { id: 4, tableId: 10, name: '分類', type: 'single_select', options: { choices: [{ id: 'a', name: '蔬菜' }] } },
  { id: 7, tableId: 10, name: '日期', type: 'date', options: null },
  { id: 8, tableId: 10, name: '已付', type: 'boolean', options: null },
]

const INPUT = { field_1: ' 米 ', field_2: '1,000', field_4: '蔬菜', field_7: '2026/1/5', field_8: '否' }
const EXPECTED = { field_1: '米', field_2: 1000, field_4: 'a', field_7: '2026-01-05', field_8: false }
const KEYS = Object.keys(EXPECTED)

const pick = (data: Record<string, unknown>) => Object.fromEntries(KEYS.map((k) => [k, data[k]]))
const jsonReq = (method: string, body: unknown) =>
  new Request('http://localhost/api/tables/10/rows', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const ctx = { params: Promise.resolve({ tableId: '10' }) }

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
  ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
  ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ id: 100, tableId: 10, data: '{}' })
  ;(prisma.tableRow.findUnique as jest.Mock).mockResolvedValue({ id: 100, tableId: 10, data: '{}', updatedAt: new Date() })
  ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 5 }])
  ;(prisma.tableRow.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 0 } })
  ;(prisma.tableRow.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  tx.tableRow.findMany.mockResolvedValue([{ id: 100, data: {} }])
  tx.tableRow.aggregate.mockResolvedValue({ _max: { order: 0 } })
  tx.tableRow.create.mockResolvedValue({ id: 1 })
  tx.$executeRawUnsafe.mockResolvedValue(1)
})

describe('write path consistency', () => {
  it('single PATCH, batch PATCH, createTableRow and move store identical values', async () => {
    // single PATCH: JSON_SET params are (path, value) pairs; booleans travel as 'true'/'false'
    const res1 = await singlePatch(jsonReq('PATCH', { rowId: 100, data: INPUT }), ctx)
    expect(res1.status).toBe(200)
    const values = (prisma.$executeRaw as jest.Mock).mock.calls[0][0].values as unknown[]
    const single: Record<string, unknown> = {}
    for (let i = 0; i + 1 < values.length && String(values[i]).startsWith('$.field_'); i += 2) {
      const v = values[i + 1]
      single[String(values[i]).slice(2)] = v === 'true' ? true : v === 'false' ? false : v
    }

    // batch PATCH: one CASE statement carrying the merged row JSON
    jest.clearAllMocks()
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    tx.tableRow.findMany.mockResolvedValue([{ id: 100, data: {} }])
    tx.$executeRawUnsafe.mockResolvedValue(1)
    const res2 = await batchPatch(jsonReq('PATCH', { updates: [{ rowId: 100, data: INPUT }] }), ctx)
    expect(res2.status).toBe(200)
    const batchParams = tx.$executeRawUnsafe.mock.calls[0].slice(1) as unknown[]
    const batch = JSON.parse(batchParams[1] as string) as Record<string, unknown>

    // createTableRow
    jest.clearAllMocks()
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    tx.tableRow.aggregate.mockResolvedValue({ _max: { order: 0 } })
    tx.tableRow.create.mockResolvedValue({ id: 1 })
    const created = await createTableRow({ tableId: 10, input: INPUT, username: 'alice' })
    expect(created.ok).toBe(true)
    const createdData = tx.tableRow.create.mock.calls[0][0].data.data as Record<string, unknown>

    // move (same table, so the source/target schemas are identical)
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(fields)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx))
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 5 }])
    ;(prisma.tableRow.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 0 } })
    ;(prisma.tableRow.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    tx.tableRow.findMany.mockResolvedValue([])
    const res4 = await move(
      jsonReq('POST', { sourceTableId: 10, rows: [{ clientId: 'c1', sourceRowId: 5, data: INPUT }] }),
      ctx,
    )
    expect(res4.status).toBe(200)
    const moved = tx.tableRow.createMany.mock.calls[0][0].data[0].data as Record<string, unknown>

    expect(pick(single)).toEqual(EXPECTED)
    expect(pick(batch)).toEqual(EXPECTED)
    expect(pick(createdData)).toEqual(EXPECTED)
    expect(pick(moved)).toEqual(EXPECTED)
  })
})
