import { POST } from '../route'
import { authorizeAction } from '@/lib/authorize'
import { NextResponse } from 'next/server'
import { restoreWorkspace, restoreDatabase, restoreTable } from '@/modules/database/services/containerTrash'
import { invalidateMasterViewCacheForTable } from '@/modules/database/services/masterViewCache'

jest.mock('@/lib/authorize', () => ({ authorizeAction: jest.fn() }))
jest.mock('@/modules/database/services/containerTrash', () => ({
  restoreWorkspace: jest.fn(),
  restoreDatabase: jest.fn(),
  restoreTable: jest.fn(),
}))
jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
}))

const req = (body: unknown) =>
  new Request('http://localhost/api/trash/restore', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/trash/restore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: {} })
  })

  it('restores a workspace through restoreWorkspace with includeDeleted authorization', async () => {
    ;(restoreWorkspace as jest.Mock).mockResolvedValue({ ok: true, tableIds: [7, 8] })
    const res = await POST(req({ type: 'workspace', id: 3 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ message: '還原成功' })
    expect(authorizeAction).toHaveBeenCalledWith({
      workspaceId: 3, action: 'canManageWorkspace', includeDeleted: true,
    })
    expect(restoreWorkspace).toHaveBeenCalledWith(3)
    expect(invalidateMasterViewCacheForTable).toHaveBeenCalledWith(7)
    expect(invalidateMasterViewCacheForTable).toHaveBeenCalledWith(8)
  })

  it('passes through 400 when restoreDatabase says the workspace is deleted', async () => {
    ;(restoreDatabase as jest.Mock).mockResolvedValue({ ok: false, status: 400, error: '請先還原工作區' })
    const res = await POST(req({ type: 'database', id: 4 }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '請先還原工作區' })
    expect(authorizeAction).toHaveBeenCalledWith({
      databaseId: 4, action: 'canManageStructure', includeDeleted: true,
    })
    expect(invalidateMasterViewCacheForTable).not.toHaveBeenCalled()
  })

  it('rejects unknown type with 400', async () => {
    const res = await POST(req({ type: 'row', id: 1 }))
    expect(res.status).toBe(400)
    expect(authorizeAction).not.toHaveBeenCalled()
  })

  it('returns the authorize error when the role lacks permission', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      errorResponse: NextResponse.json({ error: '權限不足' }, { status: 403 }),
    })
    const res = await POST(req({ type: 'table', id: 9 }))
    expect(res.status).toBe(403)
    expect(restoreTable).not.toHaveBeenCalled()
  })
})
