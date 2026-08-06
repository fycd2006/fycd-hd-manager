import { getPopulatedTableRows } from '../rowQuery'
import { cleanupFieldDependencies } from '../rowCascade'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  tableField: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  tableRow: {
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}))

describe('getPopulatedTableRows', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('populates lookup fields correctly using linked row data', async () => {
    (prisma.tableField.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, tableId: 1, name: 'TargetRowLink', type: 'link_row', options: JSON.stringify({ targetTableId: 2 }) },
        { id: 2, tableId: 1, name: 'TargetLookup', type: 'lookup', options: JSON.stringify({ relationFieldId: 1, targetFieldId: 10 }) },
      ])
      .mockResolvedValueOnce([
        { id: 10, tableId: 2, name: 'TargetName', type: 'text' },
      ]);

    (prisma.tableRow.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 101,
          tableId: 1,
          data: JSON.stringify({ field_1: '[501]' }),
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 501,
          tableId: 2,
          data: JSON.stringify({ field_10: 'Product Alpha' }),
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ]);

    const result = await getPopulatedTableRows(1, {})
    expect(result.rows![0].data['field_2']).toBe('Product Alpha')
  })

  it('populates lookup for target field with array of objects safely', async () => {
    (prisma.tableField.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, tableId: 1, name: 'TargetRowLink', type: 'link_row', options: JSON.stringify({ targetTableId: 2 }) },
        { id: 2, tableId: 1, name: 'TargetLookup', type: 'lookup', options: JSON.stringify({ relationFieldId: 1, targetFieldId: 10 }) },
      ])
      .mockResolvedValueOnce([
        { id: 10, tableId: 2, name: 'TargetTags', type: 'multiple_select' },
      ]);

    (prisma.tableRow.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 101,
          tableId: 1,
          data: JSON.stringify({ field_1: '[501]' }),
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 501,
          tableId: 2,
          data: JSON.stringify({ field_10: [{ value: 'Tag1' }, { value: 'Tag2' }] }),
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ]);

    const result = await getPopulatedTableRows(1, {})
    expect(result.rows![0].data['field_2']).toBe('Tag1, Tag2')
  })

  it('populates created_by field safely', async () => {
    (prisma.tableField.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 1, tableId: 1, name: 'Created By', type: 'created_by', options: null },
    ]);

    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 101,
        tableId: 1,
        data: JSON.stringify({ field_1: 'JohnDoe' }),
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    const result = await getPopulatedTableRows(1, {})
    expect(result.rows![0].data['field_1']).toBe('JohnDoe')
  })
})

describe('cleanupFieldDependencies', () => {
  it('cleans up invalid relationFieldId or targetFieldId on dependent lookup fields when target field is deleted', async () => {
    (prisma.tableField.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 99, tableId: 1, type: 'lookup', options: JSON.stringify({ relationFieldId: 10, targetFieldId: 20 }) }
    ]);
    (prisma.tableField.update as jest.Mock).mockResolvedValue({});

    await cleanupFieldDependencies(20)

    expect(prisma.tableField.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { options: JSON.stringify({ relationFieldId: 10, targetFieldId: null }) }
    })
  })
})
