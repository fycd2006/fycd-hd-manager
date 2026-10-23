import { NextResponse } from 'next/server'
import { authorizeAction } from '@/lib/authorize'
import { getSessionUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getCache, setCache } from '@/lib/redis'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
    },
    databaseTable: {
      findFirst: jest.fn(),
    },
    database: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    workspace: {
      findFirst: jest.fn(),
    },
    workspaceUser: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/redis', () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}))

describe('authorizeAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.workspace.findFirst as jest.Mock).mockResolvedValue({ id: 1 })
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true })
  })

  it('should return 401 if user is not logged in', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue(null)
    
    const result = await authorizeAction({ workspaceId: 1, action: 'canEditData' })
    
    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(401)
  })

  it('should return 403 if user is not in workspace', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'user' })
    ;(getCache as jest.Mock).mockResolvedValue(null)
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue(null)
    
    const result = await authorizeAction({ workspaceId: 1, action: 'canEditData' })
    
    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(403)
  })

  it('should allow access if user has sufficient role', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'user' })
    ;(getCache as jest.Mock).mockResolvedValue(null)
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ role: 'admin' })
    
    const result = await authorizeAction({ workspaceId: 1, action: 'canEditData' })
    
    expect(result.errorResponse).toBeUndefined()
    expect(result.auth?.role).toBe('admin')
    expect(result.auth?.workspaceId).toBe(1)
  })

  it('should block access if user role does not have permission', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'user' })
    ;(getCache as jest.Mock).mockResolvedValue('viewer') // cache hit
    
    // Viewer should not be able to manage structure
    const result = await authorizeAction({ workspaceId: 1, action: 'canManageStructure' })

    expect(result.errorResponse).toBeDefined()
    expect(result.errorResponse?.status).toBe(403)
  })

  it('should resolve workspace via tableId and block a member of another workspace', async () => {
    ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'user' })
    ;(getCache as jest.Mock).mockResolvedValue(null)
    // Table 20 lives in workspace B (id 2); user is only a member of workspace A
    ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 20, database: { workspaceId: 2 } })
    ;(prisma.workspaceUser.findUnique as jest.Mock).mockImplementation(async ({ where }) =>
      where.workspaceId_userId.workspaceId === 1 ? { role: 'admin' } : null
    )

    const result = await authorizeAction({ tableId: 20, action: 'canViewData' })

    expect(prisma.workspaceUser.findUnique).toHaveBeenCalledWith({
      where: { workspaceId_userId: { workspaceId: 2, userId: 1 } },
    })
    expect(result.errorResponse?.status).toBe(403)
    expect(setCache).not.toHaveBeenCalled()
  })

  describe('soft-deleted containers', () => {
    beforeEach(() => {
      ;(getSessionUser as jest.Mock).mockResolvedValue({ id: 1, role: 'user' })
      ;(getCache as jest.Mock).mockResolvedValue(null)
    })

    it('returns 404 for a deleted workspace', async () => {
      ;(prisma.workspace.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await authorizeAction({ workspaceId: 5, action: 'canViewData' })

      expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, deletedAt: null } })
      )
      expect(result.errorResponse?.status).toBe(404)
      expect((await result.errorResponse?.json()).error).toBe('找不到對應的工作區')
    })

    it('returns 404 for a deleted database', async () => {
      ;(prisma.database.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await authorizeAction({ databaseId: 9, action: 'canViewData' })

      expect(prisma.database.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9, deletedAt: null } })
      )
      expect(result.errorResponse?.status).toBe(404)
      expect((await result.errorResponse?.json()).error).toBe('找不到對應的資料庫')
    })

    it('returns 404 for a table stamped deleted with its workspace', async () => {
      ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await authorizeAction({ tableId: 20, action: 'canViewData' })

      expect(prisma.databaseTable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 20, deletedAt: null } })
      )
      expect(result.errorResponse?.status).toBe(404)
    })

    it('includeDeleted does not filter deletedAt on the table path', async () => {
      ;(prisma.databaseTable.findFirst as jest.Mock).mockResolvedValue({ id: 20, database: { workspaceId: 2 } })
      ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ role: 'admin' })

      const result = await authorizeAction({ tableId: 20, action: 'canManageStructure', includeDeleted: true })

      expect(prisma.databaseTable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 20 } })
      )
      expect(result.errorResponse).toBeUndefined()
    })

    it('includeDeleted resolves a deleted workspace and still checks the role', async () => {
      ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ role: 'viewer' })

      const result = await authorizeAction({ workspaceId: 5, action: 'canManageWorkspace', includeDeleted: true })

      expect(prisma.workspace.findFirst).not.toHaveBeenCalled()
      expect(result.errorResponse?.status).toBe(403)
    })

    it('includeDeleted resolves a deleted database without filtering deletedAt', async () => {
      ;(prisma.database.findFirst as jest.Mock).mockResolvedValue({ id: 9, workspaceId: 3 })
      ;(prisma.workspaceUser.findUnique as jest.Mock).mockResolvedValue({ role: 'admin' })

      const result = await authorizeAction({ databaseId: 9, action: 'canManageStructure', includeDeleted: true })

      expect(prisma.database.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 9 } })
      )
      expect(result.auth?.workspaceId).toBe(3)
    })
  })
})
