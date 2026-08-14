import {
  cascadeRecomputeSingleLevel,
  computeRowFormulas,
  cleanupFieldDependencies,
  waitForPendingCascadeTasks,
  SYNC_CASCADE_LIMIT,
} from '../rowCascade'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tableField: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tableRow: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}))

describe('Row Cascade Engine (P1 Debt Resolution: Unlimited Chunked Cascade)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('computeRowFormulas', () => {
    it('evaluates dynamic formula fields correctly', () => {
      const rowData = { field_1: 10, field_2: 20, field_3: '' }
      const tableFields = [
        { id: 1, type: 'number', options: {} },
        { id: 2, type: 'number', options: {} },
        { id: 3, type: 'formula', options: JSON.stringify({ expression: 'field_1 + field_2' }) },
      ]

      const computed = computeRowFormulas(rowData, tableFields)
      expect(computed.field_3).toBe('30')
    })

    it('detects circular dependencies and flags #CIRCULAR!', () => {
      const rowData = { field_1: '', field_2: '' }
      const tableFields = [
        { id: 1, type: 'formula', options: JSON.stringify({ expression: 'field_2' }) },
        { id: 2, type: 'formula', options: JSON.stringify({ expression: 'field_1' }) },
      ]

      const computed = computeRowFormulas(rowData, tableFields)
      expect(computed.field_1).toBe('#CIRCULAR!')
      expect(computed.field_2).toBe('#CIRCULAR!')
    })
  })

  describe('cascadeRecomputeSingleLevel', () => {
    it('synchronously recomputes and returns small datasets (<= 50 rows)', async () => {
      // Relation field pointing to updatedTableId 10
      ;(prisma.tableField.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 100, tableId: 20, type: 'link_row', options: JSON.stringify({ targetTableId: 10 }) },
        ])
        // Field schema for table 20
        .mockResolvedValueOnce([
          { id: 1, tableId: 20, type: 'number', options: {} },
          { id: 2, tableId: 20, type: 'formula', options: JSON.stringify({ expression: 'field_1 * 2' }) },
        ])

      // Candidate rows from SQL query
      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([{ id: 101 }, { id: 102 }])

      // Table row records linking to updatedRowId 5
      ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
        { id: 101, tableId: 20, data: JSON.stringify({ field_100: [5], field_1: 25, field_2: '' }) },
        { id: 102, tableId: 20, data: JSON.stringify({ field_100: [5], field_1: 40, field_2: '' }) },
      ])

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (updates) => {
        return updates
      })

      const affected = await cascadeRecomputeSingleLevel(10, 5)

      expect(affected).toHaveLength(2)
      expect(affected[0].data.field_2).toBe('50')
      expect(affected[1].data.field_2).toBe('80')
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('processes large datasets (> 50 rows, e.g. 120 rows) without dropping rows or hitting 300 cutoff', async () => {
      ;(prisma.tableField.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { id: 100, tableId: 20, type: 'link_row', options: JSON.stringify({ targetTableId: 10 }) },
        ])
        .mockResolvedValueOnce([
          { id: 1, tableId: 20, type: 'number', options: {} },
          { id: 2, tableId: 20, type: 'formula', options: JSON.stringify({ expression: 'field_1 + 100' }) },
        ])

      const totalRowsCount = 120
      const mockRawIds = Array.from({ length: totalRowsCount }, (_, i) => ({ id: 1000 + i }))
      const mockRows = Array.from({ length: totalRowsCount }, (_, i) => ({
        id: 1000 + i,
        tableId: 20,
        data: JSON.stringify({ field_100: [5], field_1: i, field_2: '' }),
      }))

      ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRawIds)
      ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue(mockRows)
      ;(prisma.$transaction as jest.Mock).mockResolvedValue([])

      // Call cascade recompute
      const syncResult = await cascadeRecomputeSingleLevel(10, 5)

      // Fast-path should return exactly SYNC_CASCADE_LIMIT (50) rows immediately
      expect(syncResult).toHaveLength(SYNC_CASCADE_LIMIT)
      expect(syncResult[0].data.field_2).toBe('100') // 0 + 100
      expect(syncResult[49].data.field_2).toBe('149') // 49 + 100

      // Await background chunked engine to process remaining 70 rows
      await waitForPendingCascadeTasks()

      // prisma.$transaction should have been called for sync batch (1-50) AND background chunk (51-120)
      expect(prisma.$transaction).toHaveBeenCalledTimes(2)
    })

    it('returns empty array when no dependent tables link to updatedTableId', async () => {
      ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([])

      const result = await cascadeRecomputeSingleLevel(99, 1)
      expect(result).toEqual([])
      expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })
  })

  describe('cleanupFieldDependencies', () => {
    it('sets referenced deletedFieldId to null in lookup and rollup options', async () => {
      ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
        {
          id: 50,
          type: 'lookup',
          options: JSON.stringify({ relationFieldId: 999, targetFieldId: 888 }),
        },
      ])
      ;(prisma.tableField.update as jest.Mock).mockResolvedValue({})

      await cleanupFieldDependencies(999)

      expect(prisma.tableField.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: {
          options: { relationFieldId: null, targetFieldId: 888 },
        },
      })
    })
  })
})
