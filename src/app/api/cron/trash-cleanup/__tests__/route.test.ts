import { GET } from '../route'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableRow: { deleteMany: jest.fn() },
    databaseTable: { deleteMany: jest.fn() },
    tableField: { deleteMany: jest.fn() },
  },
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
  })

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret
  })

  const deletesNothing = () => {
    expect(prisma.tableRow.deleteMany).not.toHaveBeenCalled()
    expect(prisma.databaseTable.deleteMany).not.toHaveBeenCalled()
    expect(prisma.tableField.deleteMany).not.toHaveBeenCalled()
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
    expect(prisma.tableField.deleteMany).toHaveBeenCalledWith({ where })
  })
})
