import { NextResponse } from 'next/server'
import { PATCH, DELETE } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: { findMany: jest.fn() },
    tableRow: { findFirst: jest.fn() },
    masterViewOverride: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

describe('Route Handler Integration: /api/workspaces/[id]/master-views/[viewId]/rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 7, tableId: 5, name: '備註', type: 'text', options: null },
      { id: 8, tableId: 5, name: '數量', type: 'number', options: null },
    ])
  })

  describe('PATCH (Upsert Override)', () => {
    it('rejects with 403 when user lacks canEditData on the workspace', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        errorResponse: NextResponse.json({ error: '權限不足：您只有檢視權限' }, { status: 403 }),
      })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: 5,
          sourceRowId: 100,
          overrides: { customNote: 'Hello' },
        }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await PATCH(request, { params })
      expect(response.status).toBe(403)
      expect(prisma.masterViewOverride.upsert).not.toHaveBeenCalled()
    })

    it('upserts override successfully when authorized', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        auth: { user: { id: 1 }, role: 'member' },
      })

      const mockSaved = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 5,
        sourceRowId: 100,
        overrides: JSON.stringify({ field_7: 'Approved' }),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      ;(prisma.masterViewOverride.upsert as jest.Mock).mockResolvedValue(mockSaved)

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: 5,
          sourceRowId: 100,
          overrides: { field_7: 'Approved' },
        }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await PATCH(request, { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.override.overrides).toEqual({ field_7: 'Approved' })
      expect(prisma.masterViewOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            masterViewId_sourceTableId_sourceRowId: {
              masterViewId: 10,
              sourceTableId: 5,
              sourceRowId: 100,
            },
          },
        })
      )
    })

    it('rejects an override key that is not a field of the source table, writing nothing', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'member' } })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTableId: 5, sourceRowId: 100, overrides: { customNote: 'Hello' } }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '1', viewId: '10' }) })

      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('覆寫欄位不屬於來源資料表：customNote')
      expect(prisma.masterViewOverride.upsert).not.toHaveBeenCalled()
    })

    it('stamps a latest_comment override with the session user, ignoring a forged user', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1, username: 'bob' }, role: 'member' } })
      ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
        { id: 6, tableId: 5, name: '留言', type: 'latest_comment', options: null },
      ])
      ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({ data: {} })
      ;(prisma.masterViewOverride.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.masterViewOverride.upsert as jest.Mock).mockImplementation(async ({ create }) => ({ ...create }))

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: 5,
          sourceRowId: 100,
          overrides: { field_6: [{ id: 'c1', user: 'admin', time: '2000/01/01', content: 'hi' }] },
        }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '1', viewId: '10' }) })

      expect(response.status).toBe(200)
      const saved = (prisma.masterViewOverride.upsert as jest.Mock).mock.calls[0][0].create.overrides
      expect(saved.field_6[0].user).toBe('bob')
    })

    it('rejects with 400 and writes nothing when an override value is invalid for the source field', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'member' } })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTableId: 5, sourceRowId: 100, overrides: { field_7: 'ok', field_8: 'abc' } }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '1', viewId: '10' }) })

      expect(response.status).toBe(400)
      expect((await response.json()).error).toContain('欄位 [數量] 驗證失敗：')
      expect(prisma.masterViewOverride.upsert).not.toHaveBeenCalled()
    })

    it('rejects an override that would add a select option to the source field', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({ auth: { user: { id: 1 }, role: 'member' } })
      ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
        { id: 9, tableId: 5, name: '組別', type: 'single_select', options: { choices: [{ id: 'a', name: '甲' }] } },
      ])

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTableId: 5, sourceRowId: 100, overrides: { field_9: '新組' } }),
      })
      const response = await PATCH(request, { params: Promise.resolve({ id: '1', viewId: '10' }) })

      expect(response.status).toBe(400)
      expect(prisma.masterViewOverride.upsert).not.toHaveBeenCalled()
    })

    it('rejects with 400 when sourceTableId or sourceRowId is missing', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        auth: { user: { id: 1 }, role: 'member' },
      })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrides: { field_7: 'Approved' },
        }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await PATCH(request, { params })
      expect(response.status).toBe(400)
    })
  })

  describe('DELETE (Revert Override)', () => {
    it('reverts single row override successfully', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        auth: { user: { id: 1 }, role: 'member' },
      })

      const mockExisting = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 5,
        sourceRowId: 100,
        overrides: JSON.stringify({ customNote: 'Approved' }),
        deletedAt: null,
      }
      ;(prisma.masterViewOverride.findUnique as jest.Mock).mockResolvedValue(mockExisting)
      ;(prisma.masterViewOverride.update as jest.Mock).mockResolvedValue({ ...mockExisting, deletedAt: new Date() })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTableId: 5,
          sourceRowId: 100,
        }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await DELETE(request, { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(1)
      expect(prisma.masterViewOverride.update).toHaveBeenCalled()
    })

    it('batch reverts multiple row overrides in a single request', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        auth: { user: { id: 1 }, role: 'member' },
      })

      ;(prisma.masterViewOverride.updateMany as jest.Mock).mockResolvedValue({ count: 3 })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { sourceTableId: 5, sourceRowId: 100 },
            { sourceTableId: 5, sourceRowId: 101 },
            { sourceTableId: 6, sourceRowId: 200 },
          ],
        }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await DELETE(request, { params })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.count).toBe(3)
      expect(prisma.masterViewOverride.updateMany).toHaveBeenCalledWith({
        where: {
          masterViewId: 10,
          deletedAt: null,
          OR: [
            { sourceTableId: 5, sourceRowId: 100 },
            { sourceTableId: 5, sourceRowId: 101 },
            { sourceTableId: 6, sourceRowId: 200 },
          ],
        },
        data: {
          deletedAt: expect.any(Date),
        },
      })
    })

    it('rejects batch DELETE with 400 when items list is empty or invalid', async () => {
      ;(authorizeAction as jest.Mock).mockResolvedValue({
        auth: { user: { id: 1 }, role: 'member' },
      })

      const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      })
      const params = Promise.resolve({ id: '1', viewId: '10' })

      const response = await DELETE(request, { params })
      expect(response.status).toBe(400)
    })
  })
})

