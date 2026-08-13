/**
 * Tests for getAuthorizedTableIds — the batch permission pre-filter.
 *
 * These tests mock Prisma to verify the query shape and filtering logic
 * without needing a live database connection.
 */

// Mock prisma before importing the module under test
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: {
      findMany: jest.fn()
    }
  }
}))

import prisma from '@/lib/prisma'
import { getAuthorizedTableIds } from '@/app/api/workspaces/[id]/all-rows/route'

const mockFindMany = prisma.databaseTable.findMany as jest.MockedFunction<typeof prisma.databaseTable.findMany>

describe('getAuthorizedTableIds', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return only non-deleted tables belonging to the workspace', async () => {
    // Simulate: workspace 1 has tables 10, 20, 30 (all non-deleted, under databases in workspace 1)
    mockFindMany.mockResolvedValue([
      { id: 10 } as any,
      { id: 20 } as any,
      { id: 30 } as any,
    ])

    const result = await getAuthorizedTableIds(1)

    expect(result).toEqual([10, 20, 30])
    // Verify the query shape: single call, correct where clause
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        database: { workspaceId: 1 }
      },
      select: { id: true }
    })
  })

  it('should return empty array when workspace has no tables', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getAuthorizedTableIds(99)

    expect(result).toEqual([])
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })

  it('should exclude soft-deleted tables via the where clause', async () => {
    // The where clause includes `deletedAt: null`, so Prisma won't return deleted tables.
    // We verify the query is shaped correctly.
    mockFindMany.mockResolvedValue([
      { id: 10 } as any,
      // Tables 11 (soft-deleted) and 12 (orphan) are NOT returned by Prisma
      // because the where clause filters them out at the DB level.
    ])

    const result = await getAuthorizedTableIds(1)

    expect(result).toEqual([10])
    // Confirm the where clause enforces deletedAt: null
    const callArgs = mockFindMany.mock.calls[0][0]
    expect(callArgs?.where?.deletedAt).toBeNull()
    // Confirm the where clause scopes to workspace via database relation
    expect(callArgs?.where?.database).toEqual({ workspaceId: 1 })
  })

  it('should NOT make N+1 calls — always exactly 1 query', async () => {
    // Even for a workspace with many tables, only 1 Prisma call should happen
    const manyTables = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 } as any))
    mockFindMany.mockResolvedValue(manyTables)

    const result = await getAuthorizedTableIds(1)

    expect(result).toHaveLength(100)
    expect(mockFindMany).toHaveBeenCalledTimes(1) // ← the critical assertion
  })
})
