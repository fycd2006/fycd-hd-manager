import { POST, PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/authorize', () => ({ authorizeAction: jest.fn() }))
jest.mock('@/lib/auth', () => ({ getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice' }) }))
jest.mock('@/lib/pusher-server', () => ({ triggerTableEvent: jest.fn() }))

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), createMany: jest.fn(), aggregate: jest.fn() },
  tableField: { findFirst: jest.fn(), update: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { tableField: { findMany: jest.fn() }, $transaction: jest.fn() },
}))

const baseFields = [
  { id: 1, name: '名稱', type: 'text', options: null },
  { id: 2, name: '數量', type: 'number', options: null },
]

const call = (handler: typeof POST, method: string, body: unknown) =>
  handler(
    new Request('http://localhost/api/tables/10/rows/batch', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ tableId: '10' }) },
  )

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'editor' } })
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(baseFields)
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  tx.tableRow.aggregate.mockResolvedValue({ _max: { order: 0 } })
  tx.tableRow.findMany.mockResolvedValue([])
})

describe('PATCH batch with cellWrite', () => {
  it('writes only valid cells, keeps the stored value of rejected ones and reports them', async () => {
    tx.tableRow.findMany.mockResolvedValue([
      { id: 1, data: { field_1: '舊', field_2: 9 } },
      { id: 2, data: { field_2: 1 } },
    ])

    const res = await call(PATCH, 'PATCH', {
      updates: [
        { rowId: 1, data: { field_2: 'abc', field_1: 'x' } },
        { rowId: 2, data: { field_2: '5' } },
      ],
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rejected).toEqual([expect.objectContaining({ rowId: 1, fieldId: 2, code: 'invalid_number' })])
    expect(body.updates.map((u: { rowId: number; data: unknown }) => [u.rowId, u.data])).toEqual([
      [1, { field_1: 'x', field_2: 9 }],
      [2, { field_2: 5 }],
    ])
  })

  it('does not write or return a row whose every provided cell was rejected', async () => {
    tx.tableRow.findMany.mockResolvedValue([
      { id: 1, data: { field_2: 9 } },
      { id: 2, data: { field_2: 1 } },
    ])

    const res = await call(PATCH, 'PATCH', {
      updates: [
        { rowId: 1, data: { field_2: 'abc' } },
        { rowId: 2, data: { field_2: '5' } },
      ],
    })

    const body = await res.json()
    expect(body.updates.map((u: { rowId: number }) => u.rowId)).toEqual([2])
    const [sql, ...params] = tx.$executeRawUnsafe.mock.calls[0]
    expect(sql).toContain('WHEN ? THEN ?')
    expect(params).toEqual([2, JSON.stringify({ field_2: 5 }), 2, 10])
  })

  it('adds an unknown select option once, remaps both rows to the same id and emits field-updated once', async () => {
    const selectField = { id: 3, name: '類別', type: 'single_select', options: { choices: [] } }
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([...baseFields, selectField])
    tx.tableRow.findMany.mockResolvedValue([
      { id: 1, data: {} },
      { id: 2, data: {} },
    ])
    tx.tableField.findFirst.mockResolvedValue(selectField)
    tx.tableField.update.mockImplementation(async ({ data }) => ({ id: 3, options: data.options }))

    const res = await call(PATCH, 'PATCH', {
      updates: [
        { rowId: 1, data: { field_3: '新選項' } },
        { rowId: 2, data: { field_3: '新選項' } },
      ],
      socket_id: 'sock',
    })

    expect(res.status).toBe(200)
    expect(tx.tableField.update).toHaveBeenCalledTimes(1)
    const { updates } = await res.json()
    const ids = updates.map((u: { data: Record<string, unknown> }) => u.data.field_3)
    expect(typeof ids[0]).toBe('string')
    expect(ids[0]).toBe(ids[1])
    const fieldEvents = (triggerTableEvent as jest.Mock).mock.calls.filter((c) => c[1] === 'field-updated')
    expect(fieldEvents).toHaveLength(1)
    expect(fieldEvents[0][2].field).toEqual(expect.objectContaining({ id: 3, name: '類別' }))
    expect(fieldEvents[0]).toHaveLength(3)
  })

  it('rejects a non-blank write to a read-only field', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([...baseFields, { id: 4, name: '編號', type: 'autonumber', options: null }])
    tx.tableRow.findMany.mockResolvedValue([{ id: 1, data: { field_4: 7 } }])

    const body = await (await call(PATCH, 'PATCH', { updates: [{ rowId: 1, data: { field_4: 99, field_1: 'x' } }] })).json()

    expect(body.rejected).toEqual([expect.objectContaining({ rowId: 1, fieldId: 4, code: 'read_only' })])
    expect(body.updates[0].data.field_4).toBe(7)
  })
})

describe('POST batch with cellWrite', () => {
  it('creates both rows, leaves rejected cells empty and reports them with clientId', async () => {
    const res = await call(POST, 'POST', {
      rows: [
        { clientId: 'a', data: { field_1: '米', field_2: '5' } },
        { clientId: 'b', data: { field_2: 'abc' } },
      ],
    })

    expect(res.status).toBe(201)
    const created = tx.tableRow.createMany.mock.calls[0][0].data
    expect(created.map((r: { data: unknown }) => r.data)).toEqual([{ field_1: '米', field_2: 5 }, {}])
    expect((await res.json()).rejected).toEqual([
      expect.objectContaining({ clientId: 'b', fieldId: 2, code: 'invalid_number' }),
    ])
  })

  it('rejects pasted autonumber values and still allocates numbers on the server', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([...baseFields, { id: 4, name: '編號', type: 'autonumber', options: null }])
    tx.databaseTable.findUnique.mockResolvedValue({ id: 10, autonumberCounter: 3 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 5 })

    const res = await call(POST, 'POST', { rows: [{ clientId: 'a', data: { field_4: 100 } }, { clientId: 'b' }] })

    const created = tx.tableRow.createMany.mock.calls[0][0].data
    expect(created.map((r: { data: Record<string, unknown> }) => r.data.field_4)).toEqual([4, 5])
    expect((await res.json()).rejected).toEqual([
      expect.objectContaining({ clientId: 'a', fieldId: 4, code: 'read_only' }),
    ])
  })

  it('adds an unknown select option once, stores the same id in both rows and emits field-updated once', async () => {
    const selectField = { id: 3, name: '類別', type: 'single_select', options: { choices: [] } }
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([...baseFields, selectField])
    tx.tableField.findFirst.mockResolvedValue(selectField)
    tx.tableField.update.mockImplementation(async ({ data }) => ({ id: 3, options: data.options }))

    const res = await call(POST, 'POST', {
      rows: [
        { clientId: 'a', data: { field_3: '新選項' } },
        { clientId: 'b', data: { field_3: '新選項' } },
      ],
      socket_id: 'sock',
    })

    expect(res.status).toBe(201)
    expect(tx.tableField.update).toHaveBeenCalledTimes(1)
    const created = tx.tableRow.createMany.mock.calls[0][0].data
    expect(created[0].data.field_3).toBeTruthy()
    expect(created[0].data.field_3).toBe(created[1].data.field_3)
    const fieldEvents = (triggerTableEvent as jest.Mock).mock.calls.filter((c) => c[1] === 'field-updated')
    expect(fieldEvents).toHaveLength(1)
  })
})
