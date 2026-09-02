import { NextResponse } from 'next/server'
import { PATCH } from '../route'
import { authorizeAction } from '@/lib/authorize'
import prisma from '@/lib/prisma'
import { triggerTableEvent } from '@/lib/pusher-server'

jest.mock('@/lib/auth', () => ({
  getSessionUser: jest.fn().mockResolvedValue({ id: 1, username: 'testuser' }),
  getSessionUsername: jest.fn().mockResolvedValue('testuser'),
}))

jest.mock('@/lib/authorize', () => ({
  authorizeAction: jest.fn(),
}))

jest.mock('@/lib/pusher-server', () => ({
  triggerTableEvent: jest.fn(),
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
    $executeRaw: jest.fn(),
    tableField: {
      findMany: jest.fn(),
    },
    tableRow: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('Route Handler Integration: PATCH /api/tables/[tableId]/rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('Case #10 Blind linking integration: should block with 403 when client attempts to link a row to an unauthorized target table', async () => {
    ;(authorizeAction as jest.Mock).mockImplementation(async ({ tableId, action }) => {
      if (tableId === 10 && action === 'canEditData') {
        return { auth: { user: { id: 1 }, role: 'member' } }
      }
      if (tableId === 20 && action === 'canViewData') {
        return { errorResponse: NextResponse.json({ error: '權限不足：無法存取目標資料表' }, { status: 403 }) }
      }
      return { errorResponse: NextResponse.json({ error: 'Denied' }, { status: 403 }) }
    })

    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, tableId: 10, name: 'TargetLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
    ])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: [] }),
    })

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

    expect(response.status).toBe(403)
    expect(body.error).toContain('權限不足')
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('Case #9 Link Existing integration: should allow linking when user has canEditData on source and canViewData on target', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, tableId: 10, name: 'TargetLink', type: 'link_row', options: JSON.stringify({ targetTableId: 20 }) },
    ])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: [] }),
    })

    ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
    ;(prisma.tableRow.findUnique as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: [{ id: 501, value: 'Acme' }] }),
      updatedAt: new Date(),
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
    expect(prisma.$executeRaw).toHaveBeenCalled()
    expect(triggerTableEvent).toHaveBeenCalledWith(
      10,
      'row-updated',
      expect.objectContaining({ rowId: 100 }),
      undefined
    )
  })

  it('Type Validation: should return 400 when invalid numeric value is provided to a number field', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 10, tableId: 10, name: 'Price', type: 'number', options: null },
    ])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_10: 100 }),
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        fieldKey: 'field_10',
        value: 'not-a-number',
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain('必須為數字')
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('Atomic Partial Update with JSON_SET: should execute SQL with JSON_SET fragment', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, tableId: 10, name: 'Title', type: 'text', options: null },
      { id: 2, tableId: 10, name: 'Quantity', type: 'number', options: null },
    ])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: 'Old Title', field_2: 5 }),
    })

    ;(prisma.$executeRaw as jest.Mock).mockResolvedValue(1)
    ;(prisma.tableRow.findUnique as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: 'Old Title', field_2: 42 }),
      updatedAt: new Date(),
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        fieldKey: 'field_2',
        value: 42,
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)

    // Verify $executeRaw was called for atomic update
    expect(prisma.$executeRaw).toHaveBeenCalled()
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
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('Formula recomputation on number edit: generates valid parameterized SQL and updates formula field', async () => {
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, tableId: 10, name: 'Price', type: 'number', options: null },
      { id: 2, tableId: 10, name: 'Tax', type: 'formula', options: JSON.stringify({ expression: '{field_1} * 0.05' }) },
    ])
    ;(prisma.tableRow.findFirst as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: 100, field_2: 5 }),
    })

    const executedSqls: any[] = []
    ;(prisma.$executeRaw as jest.Mock).mockImplementation(async (sqlObj: any) => {
      executedSqls.push(sqlObj)
      return 1
    })
    ;(prisma.tableRow.findUnique as jest.Mock).mockResolvedValue({
      id: 100,
      tableId: 10,
      data: JSON.stringify({ field_1: 200, field_2: 5 }),
      updatedAt: new Date(),
    })

    const request = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        fieldKey: 'field_1',
        value: 200,
      }),
    })
    const params = Promise.resolve({ tableId: '10' })

    const response = await PATCH(request, { params })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.data.field_1).toBe(200)
    expect(body.data.field_2).toBe(10) // 200 * 0.05 = 10

    // Ensure formula update query was executed with valid parameterization (not $.?)
    expect(executedSqls.length).toBe(2)
    const formulaQuery = executedSqls[1]
    const sqlText = formulaQuery.strings ? formulaQuery.strings.join('?') : ''
    expect(sqlText).not.toContain('$.?')
  })
})
