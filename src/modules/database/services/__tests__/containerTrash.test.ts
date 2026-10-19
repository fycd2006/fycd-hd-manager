import prisma from '@/lib/prisma'
import {
  softDeleteWorkspace,
  softDeleteDatabase,
  restoreWorkspace,
  restoreDatabase,
  restoreTable,
} from '../containerTrash'

jest.mock('@/lib/prisma', () => {
  const p: Record<string, unknown> = {
    workspace: { findUnique: jest.fn(), updateMany: jest.fn() },
    database: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    databaseTable: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tableField: { updateMany: jest.fn() },
    tableRow: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  }
  return { __esModule: true, default: p }
})

type MockDelegate = Record<string, jest.Mock>
const p = prisma as unknown as Record<string, MockDelegate> & { $transaction: jest.Mock }
const allUpdateManys = () => [
  p.workspace.updateMany,
  p.database.updateMany,
  p.databaseTable.updateMany,
  p.tableField.updateMany,
  p.tableRow.updateMany,
]

describe('containerTrash', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    p.$transaction.mockImplementation((arg: ((tx: typeof p) => unknown) | unknown[]) =>
      typeof arg === 'function' ? arg(p) : Promise.all(arg)
    )
  })

  it('softDeleteWorkspace stamps workspace, its live databases, tables, fields and rows with the same timestamp', async () => {
    const now = new Date('2026-10-19T00:00:00.000Z')
    p.database.findMany.mockResolvedValue([{ id: 5 }, { id: 6 }])
    p.databaseTable.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])

    await softDeleteWorkspace(1, now)

    expect(p.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 1, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.database.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 1, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.databaseTable.updateMany).toHaveBeenCalledWith({
      where: { databaseId: { in: [5, 6] }, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10, 11] }, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.tableRow.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10, 11] }, deletedAt: null },
      data: { deletedAt: now },
    })
    for (const fn of allUpdateManys()) {
      for (const call of fn.mock.calls) {
        expect(call[0].data.deletedAt).toBe(now)
        expect(call[0].where.deletedAt).toBeNull()
      }
    }
  })

  it('softDeleteDatabase stamps database, its live tables, fields and rows', async () => {
    const now = new Date('2026-10-19T00:00:00.000Z')
    p.databaseTable.findMany.mockResolvedValue([{ id: 10 }])

    await softDeleteDatabase(5, now)

    expect(p.database.updateMany).toHaveBeenCalledWith({
      where: { id: 5, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.databaseTable.updateMany).toHaveBeenCalledWith({
      where: { databaseId: 5, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10] }, deletedAt: null },
      data: { deletedAt: now },
    })
    expect(p.tableRow.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10] }, deletedAt: null },
      data: { deletedAt: now },
    })
  })

  it('restoreWorkspace only clears children deleted at the same timestamp', async () => {
    const T = new Date('2026-10-19T01:00:00.000Z')
    p.workspace.findUnique.mockResolvedValue({ deletedAt: T })
    p.database.findMany.mockResolvedValue([{ id: 5 }])
    p.databaseTable.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }])

    const result = await restoreWorkspace(1)

    expect(result).toEqual({ ok: true, tableIds: [10, 11] })
    expect(p.database.updateMany).toHaveBeenCalledWith({
      where: { workspaceId: 1, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.databaseTable.updateMany).toHaveBeenCalledWith({
      where: { databaseId: { in: [5] }, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10, 11] }, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.tableRow.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10, 11] }, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.workspace.updateMany).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { deletedAt: null },
    })
  })

  it('restoreWorkspace returns 404 for a workspace that is not deleted', async () => {
    p.workspace.findUnique.mockResolvedValue({ deletedAt: null })
    expect(await restoreWorkspace(1)).toEqual({
      ok: false,
      status: 404,
      error: '找不到已刪除的項目',
    })
    for (const fn of allUpdateManys()) expect(fn).not.toHaveBeenCalled()
  })

  it('restoreDatabase restores children deleted at the same timestamp', async () => {
    const T = new Date('2026-10-19T01:00:00.000Z')
    p.database.findUnique.mockResolvedValue({ deletedAt: T, workspace: { deletedAt: null } })
    p.databaseTable.findMany.mockResolvedValue([{ id: 10 }])

    const result = await restoreDatabase(5)

    expect(result).toEqual({ ok: true, tableIds: [10] })
    expect(p.databaseTable.updateMany).toHaveBeenCalledWith({
      where: { databaseId: 5, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: { in: [10] }, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.database.updateMany).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { deletedAt: null },
    })
  })

  it('restoreDatabase refuses when its workspace is deleted', async () => {
    p.database.findUnique.mockResolvedValue({
      deletedAt: new Date(),
      workspace: { deletedAt: new Date() },
    })
    expect(await restoreDatabase(5)).toEqual({
      ok: false,
      status: 400,
      error: '請先還原工作區',
    })
    for (const fn of allUpdateManys()) expect(fn).not.toHaveBeenCalled()
  })

  it('restoreTable refuses when its database is deleted', async () => {
    p.databaseTable.findUnique.mockResolvedValue({
      deletedAt: new Date(),
      database: { deletedAt: new Date() },
    })
    expect(await restoreTable(10)).toEqual({
      ok: false,
      status: 400,
      error: '請先還原資料庫',
    })
    expect(p.databaseTable.update).not.toHaveBeenCalled()
    expect(p.tableRow.updateMany).not.toHaveBeenCalled()
  })

  it('restoreTable returns 404 for a table that is not deleted', async () => {
    p.databaseTable.findUnique.mockResolvedValue({ deletedAt: null, database: null })
    expect(await restoreTable(10)).toEqual({
      ok: false,
      status: 404,
      error: '找不到已刪除的項目',
    })
    expect(p.databaseTable.update).not.toHaveBeenCalled()
  })

  it('restoreTable clears the table and only children deleted at the same timestamp', async () => {
    const T = new Date('2026-10-19T01:00:00.000Z')
    p.databaseTable.findUnique.mockResolvedValue({ deletedAt: T, database: { deletedAt: null } })

    expect(await restoreTable(10)).toEqual({ ok: true, tableIds: [10] })
    expect(p.databaseTable.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { deletedAt: null },
    })
    expect(p.tableRow.updateMany).toHaveBeenCalledWith({
      where: { tableId: 10, deletedAt: T },
      data: { deletedAt: null },
    })
    expect(p.tableField.updateMany).toHaveBeenCalledWith({
      where: { tableId: 10, deletedAt: T },
      data: { deletedAt: null },
    })
  })
})
