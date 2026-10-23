import { NextResponse } from 'next/server'
import { GET, PATCH, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { softDeleteWorkspace, softDeleteDatabase } from '@/modules/database/services/containerTrash'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'alice', role: 'user' }),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    workspace: { update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    database: { update: jest.fn(), delete: jest.fn() },
    databaseTable: { findFirst: jest.fn(), updateMany: jest.fn() },
  },
}))

jest.mock('@/modules/database/services/containerTrash', () => ({
  softDeleteWorkspace: jest.fn(),
  softDeleteDatabase: jest.fn(),
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

  it('DELETE delete_workspace soft deletes via softDeleteWorkspace and never calls prisma.workspace.delete', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'admin' } })
    ;(prisma.workspace.count as jest.Mock).mockResolvedValue(2)
    const res = await DELETE(new Request('http://localhost/api/workspaces?action=delete_workspace&id=2', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('工作區已移到最近刪除')
    expect(softDeleteWorkspace).toHaveBeenCalledWith(2)
    expect(prisma.workspace.delete).not.toHaveBeenCalled()
  })

  it('DELETE delete_workspace counts only live workspaces', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'admin' } })
    ;(prisma.workspace.count as jest.Mock).mockResolvedValue(1)
    const res = await DELETE(new Request('http://localhost/api/workspaces?action=delete_workspace&id=2', { method: 'DELETE' }))
    expect(prisma.workspace.count).toHaveBeenCalledWith({ where: { deletedAt: null } })
    expect(res.status).toBe(400)
    expect(softDeleteWorkspace).not.toHaveBeenCalled()
  })

  it('DELETE does not soft delete when authorize returns an error (e.g. 404 missing/deleted)', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '找不到' }, { status: 404 }),
    })
    const ws = await DELETE(new Request('http://localhost/api/workspaces?action=delete_workspace&id=2', { method: 'DELETE' }))
    const db = await DELETE(new Request('http://localhost/api/workspaces?action=delete_database&id=3', { method: 'DELETE' }))
    expect(ws.status).toBe(404)
    expect(db.status).toBe(404)
    expect(softDeleteWorkspace).not.toHaveBeenCalled()
    expect(softDeleteDatabase).not.toHaveBeenCalled()
  })

  it('DELETE delete_database soft deletes via softDeleteDatabase with canManageStructure', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'admin' } })
    const res = await DELETE(new Request('http://localhost/api/workspaces?action=delete_database&id=3', { method: 'DELETE' }))
    expect(res.status).toBe(200)
    expect((await res.json()).message).toBe('資料庫已移到最近刪除')
    expect(authorizeAction).toHaveBeenCalledWith({ databaseId: 3, action: 'canManageStructure' })
    expect(softDeleteDatabase).toHaveBeenCalledWith(3)
    expect(prisma.database.delete).not.toHaveBeenCalled()
  })

  it('GET excludes deleted workspaces and databases', async () => {
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([{ id: 1, databases: [] }])
    const res = await GET()
    expect(res.status).toBe(200)
    const arg = (prisma.workspace.findMany as jest.Mock).mock.calls[0][0]
    expect(arg.where).toMatchObject({ deletedAt: null })
    expect(arg.include.databases.where).toEqual({ deletedAt: null })
  })
})
