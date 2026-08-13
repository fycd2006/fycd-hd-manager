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
})
