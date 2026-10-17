import { NextResponse } from 'next/server'
import { PATCH, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice', role: 'user' }),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workspace: { update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    database: { update: jest.fn(), delete: jest.fn() },
  },
}))

const forbidden = () => ({
  errorResponse: NextResponse.json({ error: '權限不足：您未加入此工作區' }, { status: 403 }),
})

describe('/api/workspaces cross-workspace protection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('PATCH rename_database authorizes via databaseId and does not rename for a non-member', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(forbidden())
    const res = await PATCH(
      new Request('http://localhost/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename_database', id: 7, name: '別人的資料庫' }),
      })
    )
    expect(res.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ databaseId: 7, action: 'canManageStructure' })
    expect(prisma.database.update).not.toHaveBeenCalled()
  })

  it('DELETE delete_workspace: non-member gets 403; member cannot delete the last workspace', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue(forbidden())
    const denied = await DELETE(new Request('http://localhost/api/workspaces?action=delete_workspace&id=2', { method: 'DELETE' }))
    expect(denied.status).toBe(403)
    expect(authorizeAction).toHaveBeenCalledWith({ workspaceId: 2, action: 'canManageWorkspace' })
    expect(prisma.workspace.delete).not.toHaveBeenCalled()

    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'admin' } })
    ;(prisma.workspace.count as jest.Mock).mockResolvedValue(1)
    const last = await DELETE(new Request('http://localhost/api/workspaces?action=delete_workspace&id=2', { method: 'DELETE' }))
    expect(last.status).toBe(400)
    expect(prisma.workspace.delete).not.toHaveBeenCalled()
  })
})
