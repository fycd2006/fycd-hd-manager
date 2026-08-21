import {
  upsertMasterViewOverride,
  mergeMasterViewOverrides,
  softDeleteMasterViewOverrides,
  revertMasterViewOverride,
  revertBatchMasterViewOverrides,
} from '../masterViewOverride'
import prisma from '@/lib/prisma'
import type { MultiTableParsedRow } from '../multiTableQuery'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    masterViewOverride: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('MasterViewOverride Service (Phase 3 Hybrid Architecture)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('upsertMasterViewOverride', () => {
    it('creates or updates override payload with idempotency', async () => {
      const mockResult = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: JSON.stringify({ priority: 'URGENT', customNote: 'Reviewed by GM' }),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }

      ;(prisma.masterViewOverride.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.masterViewOverride.upsert as jest.Mock).mockResolvedValue(mockResult)

      const res = await upsertMasterViewOverride({
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: { priority: 'URGENT', customNote: 'Reviewed by GM' },
      })

      expect(prisma.masterViewOverride.upsert).toHaveBeenCalledWith({
        where: {
          masterViewId_sourceTableId_sourceRowId: {
            masterViewId: 10,
            sourceTableId: 2,
            sourceRowId: 100,
          },
        },
        create: {
          masterViewId: 10,
          sourceTableId: 2,
          sourceRowId: 100,
          overrides: { priority: 'URGENT', customNote: 'Reviewed by GM' },
          deletedAt: null,
        },
        update: {
          overrides: { priority: 'URGENT', customNote: 'Reviewed by GM' },
          deletedAt: null,
          updatedAt: expect.any(Date),
        },
      })

      expect(res.overrides).toEqual({ priority: 'URGENT', customNote: 'Reviewed by GM' })
    })

    it('merges new overrides with existing overrides on the same row', async () => {
      const existingRecord = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: JSON.stringify({ field_1: 'Original Field 1' }),
        deletedAt: null,
      }

      ;(prisma.masterViewOverride.findUnique as jest.Mock).mockResolvedValue(existingRecord)
      ;(prisma.masterViewOverride.upsert as jest.Mock).mockImplementation(async ({ create }: any) => ({
        ...existingRecord,
        overrides: JSON.stringify(create.overrides),
      }))

      const res = await upsertMasterViewOverride({
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: { field_2: 'New Field 2' },
      })

      expect(prisma.masterViewOverride.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            overrides: { field_1: 'Original Field 1', field_2: 'New Field 2' },
          }),
          update: expect.objectContaining({
            overrides: { field_1: 'Original Field 1', field_2: 'New Field 2' },
          }),
        })
      )

      expect(res.overrides).toEqual({ field_1: 'Original Field 1', field_2: 'New Field 2' })
    })


    it('throws error when required parameters are missing', async () => {
      await expect(
        upsertMasterViewOverride({
          masterViewId: 0,
          sourceTableId: 2,
          sourceRowId: 100,
          overrides: {},
        })
      ).rejects.toThrow('缺少必要的 masterViewId')
    })
  })

  describe('mergeMasterViewOverrides', () => {
    it('returns empty array when input rows are empty', async () => {
      const result = await mergeMasterViewOverrides(10, [])
      expect(result).toEqual([])
      expect(prisma.masterViewOverride.findMany).not.toHaveBeenCalled()
    })

    it('merges overrides into matching rows and marks _hasOverride', async () => {
      const mockRows: MultiTableParsedRow[] = [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          data: { field_1: 'SubTable Task 1', status: 'Pending' },
        },
        {
          id: 102,
          tableId: 2,
          createdAt: new Date('2026-01-02T00:00:00Z'),
          data: { field_1: 'SubTable Task 2', status: 'In Progress' },
        },
      ]

      // Override exists only for row 101 in table 1
      const mockOverrides = [
        {
          id: 1,
          masterViewId: 99,
          sourceTableId: 1,
          sourceRowId: 101,
          overrides: JSON.stringify({ status: 'MASTER_OVERRIDDEN', masterAssignee: 'Admin' }),
          deletedAt: null,
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]

      ;(prisma.masterViewOverride.findMany as jest.Mock).mockResolvedValue(mockOverrides)

      const merged = await mergeMasterViewOverrides(99, mockRows)

      expect(prisma.masterViewOverride.findMany).toHaveBeenCalledWith({
        where: {
          masterViewId: 99,
          deletedAt: null,
          OR: [
            { sourceTableId: 1, sourceRowId: 101 },
            { sourceTableId: 2, sourceRowId: 102 },
          ],
        },
      })

      expect(merged).toHaveLength(2)

      // Row 101 should have merged overrides and timestamp
      expect(merged[0]._hasOverride).toBe(true)
      expect(merged[0]._overrideKeys).toEqual(['status', 'masterAssignee'])
      expect(merged[0]._overrideUpdatedAt).toBe('2026-01-01T00:00:00.000Z')
      expect(merged[0].data.status).toBe('MASTER_OVERRIDDEN')
      expect(merged[0].data.masterAssignee).toBe('Admin')
      expect(merged[0].data.field_1).toBe('SubTable Task 1')
      expect(merged[0]._originalData?.status).toBe('Pending')

      // Row 102 should remain untouched
      expect(merged[1]._hasOverride).toBe(false)
      expect(merged[1].data.status).toBe('In Progress')
    })

  })

  describe('softDeleteMasterViewOverrides', () => {
    it('marks deletedAt for matching overrides when source row is deleted', async () => {
      ;(prisma.masterViewOverride.updateMany as jest.Mock).mockResolvedValue({ count: 3 })

      const res = await softDeleteMasterViewOverrides(5, 501)

      expect(prisma.masterViewOverride.updateMany).toHaveBeenCalledWith({
        where: {
          sourceTableId: 5,
          sourceRowId: 501,
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      })

      expect(res.count).toBe(3)
    })
  })

  describe('revertMasterViewOverride', () => {
    it('reverts a single field from overrides and updates record', async () => {
      const mockExisting = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: JSON.stringify({ name: 'Overridden Name', priority: 'HIGH' }),
        deletedAt: null,
      }
      prisma.masterViewOverride.findUnique = jest.fn().mockResolvedValue(mockExisting)
      prisma.masterViewOverride.update = jest.fn().mockResolvedValue({ ...mockExisting, overrides: JSON.stringify({ priority: 'HIGH' }) })

      const res = await revertMasterViewOverride({
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        fieldKey: 'name',
      })

      expect(res.success).toBe(true)
      expect(prisma.masterViewOverride.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          overrides: { priority: 'HIGH' },
          updatedAt: expect.any(Date),
        },
      })
      expect(res.remainingOverrides).toEqual({ priority: 'HIGH' })
    })

    it('soft deletes record when last overridden field is reverted', async () => {
      const mockExisting = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: JSON.stringify({ name: 'Overridden Name' }),
        deletedAt: null,
      }
      prisma.masterViewOverride.findUnique = jest.fn().mockResolvedValue(mockExisting)
      prisma.masterViewOverride.update = jest.fn().mockResolvedValue({ ...mockExisting, deletedAt: new Date() })

      const res = await revertMasterViewOverride({
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        fieldKey: 'name',
      })

      expect(res.success).toBe(true)
      expect(prisma.masterViewOverride.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deletedAt: expect.any(Date),
        },
      })
    })

    it('soft deletes entire override when no fieldKey is specified', async () => {
      const mockExisting = {
        id: 1,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
        overrides: JSON.stringify({ name: 'Overridden Name' }),
        deletedAt: null,
      }
      prisma.masterViewOverride.findUnique = jest.fn().mockResolvedValue(mockExisting)
      prisma.masterViewOverride.update = jest.fn().mockResolvedValue({ ...mockExisting, deletedAt: new Date() })

      const res = await revertMasterViewOverride({
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 100,
      })

      expect(res.success).toBe(true)
      expect(prisma.masterViewOverride.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          deletedAt: expect.any(Date),
        },
      })
    })
  })

  describe('revertBatchMasterViewOverrides', () => {
    it('returns count 0 when items array is empty', async () => {
      const res = await revertBatchMasterViewOverrides(10, [])
      expect(res.success).toBe(true)
      expect(res.count).toBe(0)
      expect(prisma.masterViewOverride.updateMany).not.toHaveBeenCalled()
    })

    it('batch soft-deletes full row overrides via single updateMany query', async () => {
      ;(prisma.masterViewOverride.updateMany as jest.Mock).mockResolvedValue({ count: 3 })

      const items = [
        { sourceTableId: 1, sourceRowId: 101 },
        { sourceTableId: 1, sourceRowId: 102 },
        { sourceTableId: 2, sourceRowId: 201 },
      ]

      const res = await revertBatchMasterViewOverrides(10, items)

      expect(res.success).toBe(true)
      expect(res.count).toBe(3)
      expect(prisma.masterViewOverride.updateMany).toHaveBeenCalledWith({
        where: {
          masterViewId: 10,
          deletedAt: null,
          OR: [
            { sourceTableId: 1, sourceRowId: 101 },
            { sourceTableId: 1, sourceRowId: 102 },
            { sourceTableId: 2, sourceRowId: 201 },
          ],
        },
        data: {
          deletedAt: expect.any(Date),
        },
      })
    })

    it('handles mixed full-row and field-specific reverts properly', async () => {
      ;(prisma.masterViewOverride.updateMany as jest.Mock).mockResolvedValue({ count: 2 })

      const mockExisting = {
        id: 99,
        masterViewId: 10,
        sourceTableId: 2,
        sourceRowId: 205,
        overrides: JSON.stringify({ priority: 'HIGH', status: 'IN_PROGRESS' }),
        deletedAt: null,
      }
      prisma.masterViewOverride.findUnique = jest.fn().mockResolvedValue(mockExisting)
      prisma.masterViewOverride.update = jest.fn().mockResolvedValue({ ...mockExisting })

      const items = [
        { sourceTableId: 1, sourceRowId: 101 },
        { sourceTableId: 1, sourceRowId: 102 },
        { sourceTableId: 2, sourceRowId: 205, fieldKey: 'status' },
      ]

      const res = await revertBatchMasterViewOverrides(10, items)

      expect(res.success).toBe(true)
      expect(res.count).toBe(3)
      expect(prisma.masterViewOverride.updateMany).toHaveBeenCalledTimes(1)
      expect(prisma.masterViewOverride.findUnique).toHaveBeenCalledTimes(1)
      expect(prisma.masterViewOverride.update).toHaveBeenCalledTimes(1)
    })
  })
})
