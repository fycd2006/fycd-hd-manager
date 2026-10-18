import { getPopulatedTableRows } from '../rowQuery'
import { cleanupFieldDependencies } from '../rowCascade'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  $queryRaw: jest.fn(),
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
    jest.resetAllMocks()
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

    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          id: 101,
          tableId: 1,
          data: { field_1: '[501]' },
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ]);
      
    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
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

    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
        {
          id: 101,
          tableId: 1,
          data: { field_1: '[501]' },
          order: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          deletedAt: null,
        },
      ]);

    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
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

    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        id: 101,
        tableId: 1,
        data: { field_1: 'JohnDoe' },
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);
    
    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([]);

    const result = await getPopulatedTableRows(1, {})
    expect(result.rows![0].data['field_1']).toBe('JohnDoe')
  })

  it('filters out soft-deleted or non-existent target rows from link_row display values completely', async () => {
    (prisma.tableField.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, tableId: 1, name: 'TargetRowLink', type: 'link_row', options: JSON.stringify({ targetTableId: 2 }) },
      ])
      .mockResolvedValueOnce([
        { id: 10, tableId: 2, name: 'TargetTitle', type: 'text' },
      ]);

    // Row 101 links to target rows [501, 502]
    // 501 is alive, 502 is soft-deleted or does not exist
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        id: 101,
        tableId: 1,
        data: { field_1: '[501, 502]' },
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    // findMany only returns alive row 501
    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 501,
        tableId: 2,
        data: JSON.stringify({ field_10: 'Alive Target' }),
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    const result = await getPopulatedTableRows(1, {})
    // console.log('DEBUG result:', JSON.stringify(result.rows![0].data))
    const linkValues = result.rows![0].data['field_1']

    expect(linkValues).toHaveLength(1)
    expect(linkValues[0]).toEqual({ id: 501, value: 'Alive Target' })
    expect(linkValues.find((item: any) => item.id === 502)).toBeUndefined()
  })

  it('guarantees strictly read-only operations without triggering any prisma updates', async () => {
    (prisma.tableField.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 5, tableId: 1, name: 'Status', type: 'single_select', options: JSON.stringify({ choices: [] }) },
    ]);

    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        id: 201,
        tableId: 1,
        data: { field_5: 'Raw Legacy Value' },
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    const result = await getPopulatedTableRows(1, {})
    expect(result.rows).toBeDefined()
    expect(prisma.tableField.update).not.toHaveBeenCalled()
  })

  it('correctly populates mixed-format link_row values (legacy {id, value} snapshot + pure ID numbers + {id} objects) with latest live titles', async () => {
    (prisma.tableField.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, tableId: 1, name: 'TargetRowLink', type: 'link_row', options: JSON.stringify({ targetTableId: 2 }) },
      ])
      .mockResolvedValueOnce([
        { id: 10, tableId: 2, name: 'TargetName', type: 'text' },
      ]);

    // Raw row containing mixed format items: legacy object with stale title, pure number ID, and object without value
    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        id: 101,
        tableId: 1,
        data: {
          field_1: [
            { id: 501, value: 'Stale Old Snapshot' },
            502,
            { id: 503 },
          ],
        },
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    // Database target rows with fresh, current names
    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 501,
        tableId: 2,
        data: JSON.stringify({ field_10: 'Fresh Alpha Name' }),
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
      {
        id: 502,
        tableId: 2,
        data: JSON.stringify({ field_10: 'Fresh Beta Name' }),
        order: 2,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
      {
        id: 503,
        tableId: 2,
        data: JSON.stringify({ field_10: 'Fresh Gamma Name' }),
        order: 3,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    const result = await getPopulatedTableRows(1, {})
    const linkValues = result.rows![0].data['field_1']

    // Assert all 3 items are parsed and populated with their fresh live titles
    expect(linkValues).toHaveLength(3)
    expect(linkValues).toEqual([
      { id: 501, value: 'Fresh Alpha Name' },
      { id: 502, value: 'Fresh Beta Name' },
      { id: 503, value: 'Fresh Gamma Name' },
    ])
  })
})

describe('getPopulatedTableRows rollup functions', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  async function rollupOf(rollupFunction: string) {
    (prisma.tableField.findMany as jest.Mock)
      .mockResolvedValueOnce([
        { id: 1, tableId: 1, name: 'Items', type: 'link_row', options: JSON.stringify({ targetTableId: 2 }) },
        { id: 2, tableId: 1, name: 'Total', type: 'rollup', options: JSON.stringify({ relationFieldId: 1, targetFieldId: 10, rollupFunction }) },
      ])
      .mockResolvedValueOnce([
        { id: 10, tableId: 2, name: 'Amount', type: 'number' },
      ]);

    (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        id: 101,
        tableId: 1,
        data: { field_1: '[501,502,503]' },
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      },
    ]);

    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce(
      [[501, 4], [502, 2], [503, 9]].map(([id, amount]) => ({
        id,
        tableId: 2,
        data: JSON.stringify({ field_10: amount }),
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
      }))
    )

    const result = await getPopulatedTableRows(1, {})
    return result.rows![0].data['field_2']
  }

  it.each([
    ['sum', 15],
    ['count', 3],
    ['avg', 5],
    ['average', 5],
    ['min', 2],
    ['max', 9],
    ['concat', '4, 2, 9'],
  ])('computes rollup function %s', async (fn, expected) => {
    expect(await rollupOf(fn)).toBe(expected)
  })
})

describe('getPopulatedTableRows date filter', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('compares date_equal by day in the field time zone', async () => {
    (prisma.tableField.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 3, tableId: 1, name: 'When', type: 'date', options: JSON.stringify({ date_include_time: true, date_time_zone: 'Asia/Taipei' }) },
    ]);
    (prisma.tableRow.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 1, tableId: 1, data: JSON.stringify({ field_3: '2026-10-17T23:59:00.000Z' }), order: 1, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), deletedAt: null },
      { id: 2, tableId: 1, data: JSON.stringify({ field_3: '2026-10-17T15:59:00.000Z' }), order: 2, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'), deletedAt: null },
    ])

    const result = await getPopulatedTableRows(1, { filterParam: 'field_3:date_equal:2026-10-18' })
    expect(result.rows!.map(r => r.id)).toEqual([1])
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
      data: { options: { relationFieldId: 10, targetFieldId: null } }
    })
  })
})
