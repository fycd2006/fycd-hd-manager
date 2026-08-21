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

jest.mock('@/modules/database/services/masterViewCache', () => ({
  invalidateMasterViewCacheForTable: jest.fn().mockResolvedValue(undefined),
  invalidateMasterViewCache: jest.fn().mockResolvedValue(undefined),
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
    },
  },
}))

describe('Concurrent Concurrency Test: Multi-Request PATCH /api/tables/[tableId]/rows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('handles two simultaneous PATCH requests updating different fields of the same row without Lost Updates', async () => {
    // 1. Authorize member
    ;(authorizeAction as jest.Mock).mockResolvedValue({
      auth: { user: { id: 1 }, role: 'member' },
    })

    // 2. Mock table schema with two independent fields
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 1, tableId: 10, name: 'Title', type: 'text', options: null },
      { id: 2, tableId: 10, name: 'Quantity', type: 'number', options: null },
    ])

    // Initial database state for row 100
    let simulatedDatabaseRowData: Record<string, any> = {
      field_1: 'Original Title',
      field_2: 10,
    }

    ;(prisma.tableRow.findFirst as jest.Mock).mockImplementation(async () => ({
      id: 100,
      tableId: 10,
      data: JSON.stringify(simulatedDatabaseRowData),
    }))

    // Simulate MySQL's atomic JSON_SET engine behavior
    ;(prisma.$executeRaw as jest.Mock).mockImplementation(async (sqlObj: any) => {
      const sqlStrings = sqlObj.strings || []
      const sqlValues = sqlObj.values || []
      const sqlText = sqlStrings.join('?')

      // Extract JSON path and assigned value from SQL parameters
      for (let i = 0; i < sqlValues.length; i++) {
        const val = sqlValues[i]
        if (typeof val === 'string' && val.startsWith('$.field_')) {
          const fieldKey = val.replace('$.', '')
          const nextVal = sqlValues[i + 1]
          simulatedDatabaseRowData[fieldKey] = nextVal
        }
      }
      return 1
    })

    ;(prisma.tableRow.findUnique as jest.Mock).mockImplementation(async () => ({
      id: 100,
      tableId: 10,
      data: JSON.stringify(simulatedDatabaseRowData),
      updatedAt: new Date(),
    }))

    // 3. Construct Request A: Update field_1 to "Updated Title A"
    const reqA = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        fieldKey: 'field_1',
        value: 'Updated Title A',
      }),
    })

    // 4. Construct Request B: Update field_2 to 999
    const reqB = new Request('http://localhost:3000/api/tables/10/rows', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowId: 100,
        fieldKey: 'field_2',
        value: 999,
      }),
    })

    const paramsA = Promise.resolve({ tableId: '10' })
    const paramsB = Promise.resolve({ tableId: '10' })

    // 5. Fire both requests simultaneously using Promise.all to simulate concurrent arrival
    const [resA, resB] = await Promise.all([
      PATCH(reqA, { params: paramsA }),
      PATCH(reqB, { params: paramsB }),
    ])

    // 6. Assert both requests succeeded with 200
    expect(resA.status).toBe(200)
    expect(resB.status).toBe(200)

    // 7. Verify $executeRaw was executed exactly twice (once for each atomic field update)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2)

    // 8. CRITICAL ASSERTION:
    // Both field_1 and field_2 must reflect the new updates without either overwriting the other
    expect(simulatedDatabaseRowData.field_1).toBe('Updated Title A')
    expect(simulatedDatabaseRowData.field_2).toBe(999)
  })
})
