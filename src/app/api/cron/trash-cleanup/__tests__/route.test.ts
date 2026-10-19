import { GET } from '../route'
import prisma from '@/lib/prisma'
import { cleanupFieldDependencies } from '@/modules/database/services/rowCascade'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableRow: { deleteMany: jest.fn() },
    databaseTable: { deleteMany: jest.fn() },
    tableField: { deleteMany: jest.fn(), findMany: jest.fn() },
    database: { deleteMany: jest.fn() },
    workspace: { deleteMany: jest.fn() },
  },
}))

jest.mock('@/modules/database/services/rowCascade', () => ({
  cleanupFieldDependencies: jest.fn(),
}))

const run = (headers: Record<string, string> = {}) =>
  GET(new Request('http://localhost/api/cron/trash-cleanup', { headers }))

const originalSecret = process.env.CRON_SECRET

describe('GET /api/cron/trash-cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(prisma.tableRow.deleteMany as jest.Mock).mockResolvedValue({ count: 3 })
    ;(prisma.databaseTable.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.tableField.deleteMany as jest.Mock).mockResolvedValue({ count: 2 })
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([{ id: 11 }, { id: 12 }])
    ;(prisma.database.deleteMany as jest.Mock).mockResolvedValue({ count: 4 })
    ;(prisma.workspace.deleteMany as jest.Mock).mockResolvedValue({ count: 5 })
    ;(cleanupFieldDependencies as jest.Mock).mockResolvedValue(undefined)
  })

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret
  })

  const deletesNothing = () => {
    expect(prisma.tableRow.deleteMany).not.toHaveBeenCalled()
    expect(prisma.databaseTable.deleteMany).not.toHaveBeenCalled()
    expect(prisma.tableField.deleteMany).not.toHaveBeenCalled()
    expect(prisma.tableField.findMany).not.toHaveBeenCalled()
    expect(prisma.database.deleteMany).not.toHaveBeenCalled()
    expect(prisma.workspace.deleteMany).not.toHaveBeenCalled()
    expect(cleanupFieldDependencies).not.toHaveBeenCalled()
  }

  it('refuses to run when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await run({ authorization: 'Bearer undefined' })

    expect(res.status).toBe(503)
    deletesNothing()
  })

  it('rejects a missing or wrong bearer token', async () => {
    expect((await run()).status).toBe(401)
    expect((await run({ authorization: 'Bearer wrong' })).status).toBe(401)
    deletesNothing()
  })

  it('rejects a stale or malformed timestamp', async () => {
    const auth = { authorization: 'Bearer cron-secret' }

    expect((await run({ ...auth, 'x-cron-timestamp': String(Date.now() - 10 * 60 * 1000) })).status).toBe(401)
    expect((await run({ ...auth, 'x-cron-timestamp': 'yesterday' })).status).toBe(401)
    deletesNothing()
  })

  it('hard-deletes only items soft-deleted more than 30 days ago', async () => {
    const before = Date.now()

    const res = await run({ authorization: 'Bearer cron-secret', 'x-cron-timestamp': String(Date.now()) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ deletedRows: 3, deletedTables: 1, deletedFields: 2, retentionDays: 30 })

    const where = (prisma.tableRow.deleteMany as jest.Mock).mock.calls[0][0].where
    expect(where.deletedAt.not).toBeNull()
    const cutoff = (where.deletedAt.lte as Date).getTime()
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000
    const twentyNineDays = 29 * 24 * 60 * 60 * 1000
    expect(before - cutoff).toBeGreaterThan(twentyNineDays)
    expect(before - cutoff).toBeLessThan(thirtyOneDays)
    expect(prisma.databaseTable.deleteMany).toHaveBeenCalledWith({ where })
  })

  it('purges databases and workspaces deleted more than 30 days ago', async () => {
    const before = Date.now()

    const res = await run({ authorization: 'Bearer cron-secret', 'x-cron-timestamp': String(Date.now()) })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deletedDatabases: 4, deletedWorkspaces: 5 })

    for (const model of [prisma.database, prisma.workspace]) {
      const where = (model.deleteMany as jest.Mock).mock.calls[0][0].where
      expect(where.deletedAt.not).toBeNull()
      const age = before - (where.deletedAt.lte as Date).getTime()
      expect(age).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
      expect(age).toBeLessThan(31 * 24 * 60 * 60 * 1000)
    }
  })

  it('cleans lookup/rollup references for each purged field', async () => {
    const res = await run({ authorization: 'Bearer cron-secret' })

    expect(res.status).toBe(200)
    expect(cleanupFieldDependencies).toHaveBeenCalledTimes(2)
    expect(cleanupFieldDependencies).toHaveBeenCalledWith(11)
    expect(cleanupFieldDependencies).toHaveBeenCalledWith(12)
  })

  it('cleans references before deleting exactly the found field ids', async () => {
    const before = Date.now()

    await run({ authorization: 'Bearer cron-secret' })

    expect(prisma.tableField.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [11, 12] } } })
    const findWhere = (prisma.tableField.findMany as jest.Mock).mock.calls[0][0].where
    expect(findWhere.deletedAt.not).toBeNull()
    const age = before - (findWhere.deletedAt.lte as Date).getTime()
    expect(age).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(age).toBeLessThan(31 * 24 * 60 * 60 * 1000)

    const cleanupOrders = (cleanupFieldDependencies as jest.Mock).mock.invocationCallOrder
    const deleteOrder = (prisma.tableField.deleteMany as jest.Mock).mock.invocationCallOrder[0]
    expect(Math.max(...cleanupOrders)).toBeLessThan(deleteOrder)
  })

  it('skips field cleanup and deletion when no fields expired', async () => {
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([])

    const res = await run({ authorization: 'Bearer cron-secret' })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deletedFields: 0 })
    expect(cleanupFieldDependencies).not.toHaveBeenCalled()
    expect(prisma.tableField.deleteMany).not.toHaveBeenCalled()
  })
})
