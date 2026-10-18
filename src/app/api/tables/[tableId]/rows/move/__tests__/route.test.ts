import { NextResponse } from 'next/server'
import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice' }),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
}))

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), createMany: jest.fn() },
  tableField: { findFirst: jest.fn(), update: jest.fn() },
  $queryRaw: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findMany: jest.fn() },
    tableRow: { findMany: jest.fn(), aggregate: jest.fn(), deleteMany: jest.fn() },
    moveOperationLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

const allow = () => ({ auth: { user: { id: 1 }, role: 'editor' } })
const deny = () => ({ errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }) })

const sourceFields = [
  { id: 1, tableId: 20, name: '名稱', type: 'text', options: null },
  { id: 2, tableId: 20, name: '數量', type: 'number', options: null },
]
const targetFields = [
  { id: 11, tableId: 10, name: '名稱', type: 'text', options: null },
  { id: 12, tableId: 10, name: '數量', type: 'number', options: null },
]

const move = (body: unknown, tableId = '10') =>
  POST(new Request(`http://localhost/api/tables/${tableId}/rows/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ tableId }) })

const fieldsFor = (src: unknown[], dst: unknown[]) =>
  (prisma.tableField.findMany as jest.Mock).mockImplementation(async ({ where }) => (where.tableId === 20 ? src : dst))

beforeEach(() => {
  jest.clearAllMocks()
  ;(authorizeAction as jest.Mock).mockResolvedValue(allow())
  fieldsFor(sourceFields, targetFields)
  ;(prisma.tableRow.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 5000 } })
  // every requested source row exists in the source table (scoping is covered in route.scope.test.ts)
  ;(prisma.tableRow.findMany as jest.Mock).mockImplementation(async ({ where }) => where.id.in.map((id: number) => ({ id })))
  ;(prisma.tableRow.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(tx))
  tx.tableRow.findMany.mockResolvedValue([{ id: 900 }])
})

describe('POST /api/tables/[tableId]/rows/move', () => {
  it('requires canEditData on the target table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValueOnce(deny())

    const res = await move({ sourceTableId: 20, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ tableId: 10, action: 'canEditData' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('requires canEditData on the source table', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValueOnce(allow()).mockResolvedValueOnce(deny())

    const res = await move({ sourceTableId: 20, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenLastCalledWith({ tableId: 20, action: 'canEditData' })
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects cross-table moves when the schemas differ', async () => {
    fieldsFor(sourceFields, [targetFields[0], { ...targetFields[1], type: 'text' }])

    const res = await move({ sourceTableId: 20, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects cross-table moves when the field counts differ', async () => {
    fieldsFor(sourceFields, [targetFields[0]])

    const res = await move({ sourceTableId: 20, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(400)
  })

  it('maps source field values onto target fields by position and appends after the last row', async () => {
    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_1: '高麗菜', field_2: '3' } }],
      socket_id: 'sock',
    })

    expect(res.status).toBe(200)
    expect(tx.tableRow.createMany).toHaveBeenCalledWith({
      data: [{ tableId: 10, clientId: 'c1', data: { field_11: '高麗菜', field_12: 3 }, order: 6000 }],
    })
    expect(triggerTableEvent).toHaveBeenCalledWith(10, 'rows-batch-changed', expect.any(Object), 'sock')
    expect(triggerTableEvent).toHaveBeenCalledWith(20, 'rows-batch-changed', expect.any(Object), 'sock')
  })

  it('broadcasts field-updated for a server-added option to every client, including the originator', async () => {
    const srcSelect = { id: 3, tableId: 20, name: '類別', type: 'single_select', options: { choices: [] } }
    const dstSelect = { id: 13, tableId: 10, name: '類別', type: 'single_select', options: { choices: [] } }
    fieldsFor([...sourceFields, srcSelect], [...targetFields, dstSelect])
    tx.tableField.findFirst.mockResolvedValue(dstSelect)
    tx.tableField.update.mockImplementation(async ({ data }) => ({ id: 13, options: data.options }))

    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_3: '新選項' } }],
      socket_id: 'sock',
    })

    expect(res.status).toBe(200)
    const fieldEvents = (triggerTableEvent as jest.Mock).mock.calls.filter((c) => c[1] === 'field-updated')
    expect(fieldEvents).toHaveLength(1)
    expect(fieldEvents[0]).toHaveLength(3)
    expect(fieldEvents[0][2].field).toEqual(expect.objectContaining({ id: 13, name: '類別' }))
  })

  it('keeps the original author and time of existing comments when moving a row', async () => {
    const srcComment = { id: 3, tableId: 20, name: '備註', type: 'latest_comment', options: null }
    const dstComment = { id: 13, tableId: 10, name: '備註', type: 'latest_comment', options: null }
    fieldsFor([...sourceFields, srcComment], [...targetFields, dstComment])
    const stored = [{ id: 'c-1', user: 'bob', time: '2026/01/02 03:04:05', content: '原留言' }]
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([{ id: 5, data: { field_3: stored } }])

    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_3: [{ id: 'c-1', user: 'mallory', time: 'now', content: '原留言' }] } }],
    })

    expect(res.status).toBe(200)
    const created = tx.tableRow.createMany.mock.calls[0][0].data[0].data
    expect(created.field_13).toEqual([expect.objectContaining({ id: 'c-1', user: 'bob', time: '2026/01/02 03:04:05', content: '原留言' })])
  })

  it('rejects a value that fails target field validation before writing anything', async () => {
    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_2: 'not a number' } }],
    })

    expect(res.status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.tableRow.deleteMany).not.toHaveBeenCalled()
  })

  it('names the field and reason when a value fails target validation', async () => {
    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'c1', sourceRowId: 5, data: { field_2: 'abc' } }],
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('欄位 [數量] 驗證失敗：')
  })

  it('does not carry the source autonumber value; the target assigns its own', async () => {
    fieldsFor(
      [...sourceFields, { id: 3, tableId: 20, name: '編號', type: 'autonumber', options: null }],
      [...targetFields, { id: 13, tableId: 10, name: '編號', type: 'autonumber', options: null }],
    )
    tx.databaseTable.findUnique.mockResolvedValue({ id: 10, autonumberCounter: 7 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 8 })

    const res = await move({
      sourceTableId: 20,
      rows: [{ clientId: 'a', sourceRowId: 5, data: { field_1: 'x', field_3: 99 } }],
    })

    expect(res.status).toBe(200)
    expect(tx.tableRow.createMany.mock.calls[0][0].data[0].data.field_13).toBe(8)
  })

  it('allocates autonumbers on the target table', async () => {
    const auto = [...targetFields, { id: 13, tableId: 10, name: '編號', type: 'autonumber', options: null }]
    fieldsFor([...sourceFields, { id: 3, tableId: 20, name: '編號', type: 'autonumber', options: null }], auto)
    tx.databaseTable.findUnique.mockResolvedValue({ id: 10, autonumberCounter: 7 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 9 })

    await move({
      sourceTableId: 20,
      rows: [{ clientId: 'a', sourceRowId: 5 }, { clientId: 'b', sourceRowId: 6 }],
    })

    expect(tx.databaseTable.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { autonumberCounter: { increment: 2 } } })
    const created = tx.tableRow.createMany.mock.calls[0][0].data
    expect(created.map((r: { data: Record<string, unknown> }) => r.data.field_13)).toEqual([8, 9])
  })

  it('logs a pending move operation when removing a source row fails', async () => {
    ;(prisma.tableRow.deleteMany as jest.Mock).mockRejectedValue(new Error('gone'))

    const res = await move({ sourceTableId: 20, rows: [{ clientId: 'c1', sourceRowId: 5 }] })

    expect(res.status).toBe(200)
    expect(prisma.moveOperationLog.create).toHaveBeenCalledWith({
      data: { userId: 1, sourceTableId: 20, targetTableId: 10, rowId: 5, status: 'pending' },
    })
  })

  it('returns 400 for missing rows, clientId or a bad source id', async () => {
    expect((await move({ sourceTableId: 20, rows: [] })).status).toBe(400)
    expect((await move({ sourceTableId: 20, rows: [{ sourceRowId: 5 }] })).status).toBe(400)
    expect((await move({ sourceTableId: 'x', rows: [{ clientId: 'c', sourceRowId: 5 }] })).status).toBe(400)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
