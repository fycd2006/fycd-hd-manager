import { GET, POST } from '../route'
import { getSessionUser } from '@/lib/auth'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: { findMany: jest.fn(), aggregate: jest.fn(), create: jest.fn() },
  },
}))

const create = (body: unknown) =>
  POST(new Request('http://localhost/api/tables', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 2, role: 'member' })
  ;(prisma.databaseTable.findMany as jest.Mock).mockResolvedValue([])
})

describe('GET /api/tables', () => {
  it('requires login', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await GET()

    expect(res.status).toBe(401)
    expect(prisma.databaseTable.findMany).not.toHaveBeenCalled()
  })

  it('limits non-admins to tables in workspaces they belong to (plus unattached legacy tables)', async () => {
    await GET()

    expect(prisma.databaseTable.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { databaseId: null },
          { database: { workspace: { members: { some: { userId: 2 } } } } },
        ],
      },
    }))
  })

  it('lets system admins see every table', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'admin' })

    await GET()

    expect(prisma.databaseTable.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('POST /api/tables', () => {
  it('requires login', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)

    const res = await create({ name: 'x' })

    expect(res.status).toBe(401)
    expect(prisma.databaseTable.create).not.toHaveBeenCalled()
  })

  it('creates a table with a default name field after the last table', async () => {
    ;(prisma.databaseTable.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 4 } })
    ;(prisma.databaseTable.create as jest.Mock).mockResolvedValue({ id: 9 })

    const res = await create({ name: '庫存' })

    expect(res.status).toBe(201)
    expect(prisma.databaseTable.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { name: '庫存', order: 5, fields: { create: [{ name: '名稱', type: 'text', order: 0 }] } },
    }))
  })

  it('returns 400 without a name', async () => {
    const res = await create({})

    expect(res.status).toBe(400)
    expect(prisma.databaseTable.create).not.toHaveBeenCalled()
  })
})
