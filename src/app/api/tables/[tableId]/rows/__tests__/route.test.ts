import { NextResponse } from 'next/server'
import { PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'testuser' }),
  getSessionUsername: jest.fn().mockResolvedValue('testuser'),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/modules/database/services/linkRowSync', () => ({
  syncBiDirectionalLinkRow: jest.fn().mockResolvedValue(null),
  cleanupRowLinkRowRelations: jest.fn().mockResolvedValue(undefined),
  parseLinkRowIds: jest.requireActual('@/modules/database/services/linkRowSync').parseLinkRowIds,
}))

jest.mock('@/modules/database/services/rowCascade', () => ({
  cascadeRecomputeSingleLevel: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    tableRow: {
      update: jest.fn(),
    },
  },
}))

describe('Route Handler Integration: PATCH /api/tables/[tableId]/rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Case #10 Blind linking integration: should block with 403 when client attempts to link a row to an unauthorized target table', async () => {
    // 1. Source table 10 has canEditData
    // 2. Target table 20 has NO permission (canViewData denied)
    ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
      if (tableId === 10 && action === 'canEditData') {
        return { auth: { user: { id: 1 }, role: 'member' } }
      }
      if (tableId === 20 && action === 'canViewData') {
        return { errorResponse: NextResponse.json({ error: '權限不足：無法存取目標資料表' }, { status: 403 }) }
      }
      return { errorResponse: NextResponse.json({ error: 'Denied' }, { status: 403 }) }
    })

    // Mock transaction to return current row and link_row field pointing to table 20
    ;(prisma.$transaction as jest.Mock).mockResolvedValue({
      currentRow: { id: 100, tableId: 10, data: JSON.stringify({ field_1: [] }) },
      fields: [
        { id: 1, tableId: 10, name: 'TargetLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
      ],
    })

    // Client maliciously passes new target row id [999] in payload to link to Table 20
    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        data: { field_1: [999] },
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    const body = await response.json()

    // Assertion: Intercepted and blocked with 403, and update was NEVER called
    expect(response.status).toBe(403)
    expect(body.error).toContain('權限不足')
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
  })

  it('Case #9 Link Existing integration: should allow linking when user has canEditData on source and canViewData on target', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    ;(prisma.$transaction as jest.Mock).mockResolvedValue({
      currentRow: { id: 100, tableId: 10, data: JSON.stringify({ field_1: [] }) },
      fields: [
        { id: 1, tableId: 10, name: 'TargetLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
      ],
    })

    ;(prisma.tableRow.update as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: [{ id: 501, value: 'Acme' }] }),
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        data: { field_1: [501] },
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)
    expect(prisma.tableRow.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 100 } })
    )
  })

  it('Case #6 Detach integration: should allow detaching even when target table is not checked for edit permission', async () => {
    ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
      if (tableId === 10 && action === 'canEditData') {
        return { auth: { user: { id: 1 }, role: 'member' } }
      }
      return { errorResponse: NextResponse.json({ error: 'Denied' }, { status: 403 }) }
    })

    // Current row has [501], client sends empty array [] to detach
    ;(prisma.$transaction as jest.Mock).mockResolvedValue({
      currentRow: { id: 100, tableId: 10, data: JSON.stringify({ field_1: [501] }) },
      fields: [
        { id: 1, tableId: 10, name: 'TargetLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
      ],
    })

    ;(prisma.tableRow.update as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: [] }),
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        data: { field_1: [] },
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)
    expect(prisma.tableRow.update).toHaveBeenCalled()
  })

  it('Multi-field link_row update: should block when any target table in the batch is unauthorized', async () => {
    ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
      if (tableId === 10 && action === 'canEditData') {
        return { auth: { user: { id: 1 }, role: 'member' } }
      }
      if (tableId === 20 && action === 'canViewData') {
        return { auth: { user: { id: 1 }, role: 'member' } }
      }
      if (tableId === 30 && action === 'canViewData') {
        return { errorResponse: NextResponse.json({ error: '權限不足：無法存取目標資料表 30' }, { status: 403 }) }
      }
      return { errorResponse: NextResponse.json({ error: 'Denied' }, { status: 403 }) }
    })

    ;(prisma.$transaction as jest.Mock).mockResolvedValue({
      currentRow: { id: 100, tableId: 10, data: JSON.stringify({ field_1: [], field_2: [] }) },
      fields: [
        { id: 1, tableId: 10, name: 'AllowedLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
        { id: 2, tableId: 10, name: 'ForbiddenLink', type: 'link_row', options: JSON.stringify({ targetTableId: 30 }) },
      ],
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        data: { field_1: [201], field_2: [301] },
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(403)
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
  })

  it('Direct row edit: should reject with 403 when user lacks canEditData on target table', async () => {
    ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
      if (tableId === 20 && action === 'canEditData') {
        return { errorResponse: NextResponse.json({ error: '權限不足：您只有讀取權限' }, { status: 403 }) }
      }
      return { auth: { user: { id: 1 }, role: 'viewer' } }
    })

    const request = new Request('http://localhost:3000/api/tables/20/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 501,
        fieldKey: 'field_9',
        value: 'New Title',
      }),
    })
    const params = Promise.resolve({ tableId: '20' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(403)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.tableRow.update).not.toHaveBeenCalled()
  })
})
