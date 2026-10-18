import { createTableRow } from '../createRow'
import prisma from '@/lib/prisma'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'
import { evaluateFormula } from '@/lib/formula'
import { applyOptionAdditions } from '@/modules/database/services/cellWriteOptions'

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/formula', () => ({
  extractFormulaExpression: jest.fn((opts: { formula?: string } | null) => opts?.formula || ''),
  evaluateFormula: jest.fn(),
}))

type CreateArgs = { data: Record<string, unknown> & { data?: unknown } }

const tx = {
  databaseTable: { findUnique: jest.fn(), update: jest.fn() },
  tableRow: { findMany: jest.fn(), aggregate: jest.fn(), create: jest.fn() },
}

type TxCallback = (t: typeof tx) => unknown

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/modules/database/services/cellWriteOptions', () => ({
  applyOptionAdditions: jest.fn(),
}))

const mockFields = (fields: Array<{ id: number; name?: string; type: string; options?: unknown }>) => {
  ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue(
    fields.map(f => ({ name: `F${f.id}`, options: null, ...f }))
  )
}

const createdData = () => (tx.tableRow.create as jest.Mock).mock.calls[0][0].data

describe('createTableRow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: TxCallback) => cb(tx))
    tx.tableRow.aggregate.mockResolvedValue({ _max: { order: 4 } })
    tx.tableRow.create.mockImplementation(async ({ data }: CreateArgs) => ({ id: 100, ...data }))
  })

  it('writes audit user fields from username and ignores forged input', async () => {
    mockFields([{ id: 1, type: 'created_by' }, { id: 2, type: 'last_modified_by' }])
    const res = await createTableRow({ tableId: 1, input: { field_1: 'hacker', field_2: 'hacker' }, username: 'alice' })
    expect(res.ok).toBe(true)
    expect(createdData().data).toEqual({ field_1: 'alice', field_2: 'alice' })
  })

  it('fills created_on with server time and ignores input', async () => {
    mockFields([{ id: 1, type: 'created_on' }])
    await createTableRow({ tableId: 1, input: { field_1: '1999/01/01 00:00' }, username: 'alice' })
    const value = createdData().data.field_1
    expect(value).not.toBe('1999/01/01 00:00')
    expect(value).toContain(String(new Date().getFullYear()))
  })

  it('ignores input for fields rejected by fieldFilter', async () => {
    mockFields([{ id: 1, type: 'text' }, { id: 2, type: 'text' }])
    await createTableRow({
      tableId: 1,
      input: { field_1: 'keep', field_2: 'drop' },
      username: 'alice',
      fieldFilter: f => f.id === 1,
    })
    expect(createdData().data).toEqual({ field_1: 'keep' })
  })

  it('applies default values and omits keys whose default is null', async () => {
    mockFields([
      { id: 1, type: 'boolean' },
      { id: 2, type: 'text', options: JSON.stringify({ defaultValue: '預設' }) },
      { id: 3, type: 'text' },
    ])
    await createTableRow({ tableId: 1, input: {}, username: 'alice' })
    expect(createdData().data).toEqual({ field_1: false, field_2: '預設' })
  })

  it('returns an error naming the field and does not open a transaction when validation fails', async () => {
    mockFields([{ id: 1, name: '數量', type: 'number' }])
    const res = await createTableRow({ tableId: 1, input: { field_1: 'abc' }, username: 'alice' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('數量')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('autonumber with existing counter: increments once and writes value to every autonumber field', async () => {
    mockFields([{ id: 1, type: 'autonumber' }, { id: 2, type: 'autonumber' }])
    tx.databaseTable.findUnique.mockResolvedValue({ id: 1, autonumberCounter: 7 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 8 })

    await createTableRow({ tableId: 1, input: {}, username: 'alice' })

    expect(tx.tableRow.findMany).not.toHaveBeenCalled()
    expect(tx.databaseTable.update).toHaveBeenCalledTimes(1)
    expect(tx.databaseTable.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { autonumberCounter: { increment: 1 } } })
    expect(createdData().data).toMatchObject({ field_1: 8, field_2: 8 })
  })

  it('autonumber with zero counter: seeds from max existing value (including string-encoded rows) before incrementing', async () => {
    mockFields([{ id: 1, type: 'autonumber' }])
    tx.databaseTable.findUnique.mockResolvedValue({ id: 1, autonumberCounter: 0 })
    tx.tableRow.findMany.mockResolvedValue([
      { data: { field_1: 3 } },
      { data: JSON.stringify({ field_1: '12' }) },
      { data: 'not json' },
    ])
    tx.databaseTable.update
      .mockResolvedValueOnce({ autonumberCounter: 12 })
      .mockResolvedValueOnce({ autonumberCounter: 13 })

    await createTableRow({ tableId: 1, input: {}, username: 'alice' })

    expect(tx.databaseTable.update).toHaveBeenNthCalledWith(1, { where: { id: 1 }, data: { autonumberCounter: 12 } })
    expect(createdData().data.field_1).toBe(13)
  })

  it('computes formula fields and writes #VALUE! when evaluation throws', async () => {
    mockFields([
      { id: 1, type: 'number' },
      { id: 2, type: 'formula', options: { formula: 'field(1) * 2' } },
      { id: 3, type: 'formula', options: { formula: 'broken(' } },
    ])
    ;(evaluateFormula as jest.Mock).mockImplementation((expr: string) => {
      if (expr === 'broken(') throw new Error('parse')
      return 20
    })

    await createTableRow({ tableId: 1, input: { field_1: 10 }, username: 'alice' })
    expect(createdData().data).toMatchObject({ field_1: 10, field_2: 20, field_3: '#VALUE!' })
  })

  it('double-encoding regression: passes an object (not a JSON string) to create and parses string data in the result', async () => {
    mockFields([{ id: 1, type: 'text' }])
    tx.tableRow.create.mockImplementation(async ({ data }: CreateArgs) => ({ id: 100, ...data, data: JSON.stringify(data.data) }))

    const res = await createTableRow({ tableId: 1, input: { field_1: 'hello' }, username: 'alice' })

    const written = createdData().data
    expect(typeof written).toBe('object')
    expect(written).toEqual({ field_1: 'hello' })
    expect(res.ok && res.row.data).toEqual({ field_1: 'hello' })
  })

  it('sets order to max existing order + 1, or 1 when the table is empty', async () => {
    mockFields([{ id: 1, type: 'text' }])
    await createTableRow({ tableId: 1, input: {}, username: 'alice' })
    expect(createdData().order).toBe(5)

    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: TxCallback) => cb(tx))
    tx.tableRow.aggregate.mockResolvedValue({ _max: { order: null } })
    await createTableRow({ tableId: 1, input: {}, username: 'alice' })
    expect(createdData().order).toBe(1)
  })

  it('still succeeds when master view cache invalidation fails', async () => {
    mockFields([{ id: 1, type: 'text' }])
    ;(invalidateMasterViewCacheForTable as jest.Mock).mockRejectedValueOnce(new Error('redis down'))
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await createTableRow({ tableId: 1, input: { field_1: 'x' }, username: 'alice' })

    expect(res.ok).toBe(true)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('rejects autonumber input with the field name and creates no row', async () => {
    mockFields([{ id: 1, name: '編號', type: 'autonumber' }])
    const res = await createTableRow({ tableId: 1, input: { field_1: 5 }, username: 'alice' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('欄位 [編號] 驗證失敗：')
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(tx.tableRow.create).not.toHaveBeenCalled()
  })

  it('writes a numeric default of 0', async () => {
    mockFields([{ id: 1, type: 'number', options: { defaultValue: 0 } }])
    await createTableRow({ tableId: 1, input: {}, username: 'alice' })
    expect(createdData().data).toEqual({ field_1: 0 })
  })

  const selectField = { id: 1, name: '類別', type: 'single_select', options: { choices: [{ id: 'a', name: 'A', color: '#111' }] } }

  it('public form (canAddOptions false) rejects an unknown option', async () => {
    mockFields([selectField])
    const res = await createTableRow({ tableId: 1, input: { field_1: '新選項' }, username: 'f', canAddOptions: false })
    expect(res.ok).toBe(false)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('canAddOptions true creates the row, merges options in the same transaction and returns updatedFields', async () => {
    mockFields([selectField])
    ;(applyOptionAdditions as jest.Mock).mockResolvedValue({ updated: [{ id: 1, options: { choices: ['x'] } }], remap: {} })
    const res = await createTableRow({ tableId: 1, input: { field_1: '新選項' }, username: 'alice', canAddOptions: true })
    expect(res.ok).toBe(true)
    expect(applyOptionAdditions).toHaveBeenCalledWith(tx, 1, expect.objectContaining({ 1: [expect.objectContaining({ name: '新選項' })] }))
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(tx.tableRow.create).toHaveBeenCalledTimes(1)
    if (res.ok) expect(res.updatedFields).toEqual([expect.objectContaining({ id: 1, name: '類別', options: { choices: ['x'] } })])
  })

  it('does not call applyOptionAdditions when nothing was added', async () => {
    mockFields([{ id: 1, type: 'text' }])
    const res = await createTableRow({ tableId: 1, input: { field_1: 'x' }, username: 'alice', canAddOptions: true })
    expect(applyOptionAdditions).not.toHaveBeenCalled()
    if (res.ok) expect(res.updatedFields).toBeUndefined()
  })

  it('replaces a forged latest_comment user with the acting username', async () => {
    mockFields([{ id: 1, type: 'latest_comment' }])
    await createTableRow({
      tableId: 1,
      input: { field_1: [{ id: 'c1', user: 'hacker', time: '1999', content: 'hi' }] },
      username: 'alice',
    })
    const entries = createdData().data.field_1 as Array<{ user: string }>
    expect(entries[0].user).toBe('alice')
  })

  it('ignores blocked fields from fieldFilter even when they would be rejected', async () => {
    mockFields([{ id: 1, type: 'text' }, { id: 2, type: 'formula', options: { formula: '1' } }])
    const res = await createTableRow({
      tableId: 1, input: { field_1: 'ok', field_2: 99 }, username: 'f',
      fieldFilter: f => f.type !== 'formula',
    })
    expect(res.ok).toBe(true)
  })

  it('ignores blank placeholders for formula and autonumber fields and assigns the autonumber', async () => {
    mockFields([
      { id: 1, type: 'text' },
      { id: 2, type: 'formula', options: { formula: '1' } },
      { id: 3, type: 'autonumber' },
    ])
    tx.databaseTable.findUnique.mockResolvedValue({ id: 1, autonumberCounter: 7 })
    tx.databaseTable.update.mockResolvedValue({ autonumberCounter: 8 })
    ;(evaluateFormula as jest.Mock).mockReturnValue(1)
    const res = await createTableRow({ tableId: 1, input: { field_1: 'a', field_2: '', field_3: '' }, username: 'alice' })
    expect(res.ok).toBe(true)
    expect(createdData().data).toMatchObject({ field_1: 'a', field_3: 8 })
  })
})
