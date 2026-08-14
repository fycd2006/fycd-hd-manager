import { NextResponse } from 'next/server'
import { PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    masterViewOverride: {
      upsert: jest.fn(),
    },
  },
}))

describe('Route Handler Integration: PATCH /api/workspaces/[id]/master-views/[viewId]/rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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
      overrides: JSON.stringify({ customNote: 'Approved' }),
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
        overrides: { customNote: 'Approved' },
      }),
    })
    const params = Promise.resolve({ id: '1', viewId: '10' })

    const response = await PATCH(request, { params })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.override.overrides).toEqual({ customNote: 'Approved' })
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

  it('rejects with 400 when sourceTableId or sourceRowId is missing', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    const request = new Request('http://localhost:3000/api/workspaces/1/master-views/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overrides: { customNote: 'Approved' },
      }),
    })
    const params = Promise.resolve({ id: '1', viewId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(400)
  })
})
