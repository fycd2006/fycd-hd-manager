import { parseLinkRowIds } from '../linkRowSync'

describe('parseLinkRowIds', () => {
  it('parses arrays of numeric IDs', () => {
    expect(parseLinkRowIds([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('parses arrays of object items with id property', () => {
    expect(parseLinkRowIds([{ id: 10, value: 'Item A' }, { id: 20, value: 'Item B' }])).toEqual([10, 20])
  })

  it('parses JSON string encoded arrays', () => {
    expect(parseLinkRowIds('[100, 200]')).toEqual([100, 200])
    expect(parseLinkRowIds('[{"id": 5}]')).toEqual([5])
  })

  it('parses comma-separated string IDs', () => {
    expect(parseLinkRowIds('1, 2, 3')).toEqual([1, 2, 3])
  })

  it('returns empty array for null, undefined, or empty string', () => {
    expect(parseLinkRowIds(null)).toEqual([])
    expect(parseLinkRowIds(undefined)).toEqual([])
    expect(parseLinkRowIds('')).toEqual([])
  })
})

describe('cleanupInboundLinkRowReferences', () => {
  it('cleans up deleted row id from other rows referencing it across tables', async () => {
    const { cleanupInboundLinkRowReferences } = require('../linkRowSync')
    const prisma = require('@/lib/prisma').default

    const findManyFieldsSpy = jest.spyOn(prisma.tableField, 'findMany').mockResolvedValue([
      { id: 10, tableId: 1 },
      { id: 20, tableId: 2 },
    ])

    const findManyRowsSpy = jest.spyOn(prisma.tableRow, 'findMany').mockResolvedValue([
      {
        id: 101,
        tableId: 1,
        data: JSON.stringify({ field_10: [{ id: 999, value: 'To Delete' }, { id: 888, value: 'Keep' }] }),
      },
      {
        id: 202,
        tableId: 2,
        data: JSON.stringify({ field_20: [999] }),
      },
      {
        id: 303,
        tableId: 1,
        data: JSON.stringify({ field_10: [777] }),
      },
    ])

    const updateSpy = jest.spyOn(prisma.tableRow, 'update').mockResolvedValue({} as any)

    const cleanedCount = await cleanupInboundLinkRowReferences(999)

    expect(cleanedCount).toBe(2)
    expect(updateSpy).toHaveBeenCalledTimes(2)

    // Row 101 should keep only 888
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 101 },
      data: {
        data: {
          field_10: [888],
        },
      },
    })

    // Row 202 should have empty array
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 202 },
      data: {
        data: {
          field_20: [],
        },
      },
    })

    findManyFieldsSpy.mockRestore()
    findManyRowsSpy.mockRestore()
    updateSpy.mockRestore()
  })

  it('syncBiDirectionalLinkRow writes pure ID array on added relation', async () => {
    const { syncBiDirectionalLinkRow } = require('../linkRowSync')
    const prisma = require('@/lib/prisma').default

    const findUniqueFieldSpy = jest.spyOn(prisma.tableField, 'findUnique')
      .mockResolvedValueOnce({
        id: 10,
        type: 'link_row',
        options: JSON.stringify({ relatedFieldId: 20, targetTableId: 2 }),
      } as any)
      .mockResolvedValueOnce({
        id: 20,
        tableId: 2,
        deletedAt: null,
      } as any)

    const findManyRowsSpy = jest.spyOn(prisma.tableRow, 'findMany').mockResolvedValue([
      {
        id: 50,
        tableId: 2,
        data: JSON.stringify({ field_20: [100] }),
      },
    ] as any)

    const updateSpy = jest.spyOn(prisma.tableRow, 'update').mockResolvedValue({} as any)

    const res = await syncBiDirectionalLinkRow(1, 15, 10, [50], [])

    expect(res).toEqual({ targetTableId: 2, rowIds: [50] })
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 50 },
      data: {
        data: {
          field_20: [100, 15],
        },
      },
    })

    findUniqueFieldSpy.mockRestore()
    findManyRowsSpy.mockRestore()
    updateSpy.mockRestore()
  })
})
