import { hydrateRowCards } from '../cardHydrator'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    databaseTable: {
      findMany: jest.fn(),
    },
    tableField: {
      findMany: jest.fn(),
    },
    tableRow: {
      findMany: jest.fn(),
    },
  },
}))

describe('hydrateRowCards - Server-side authorization & card hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('negative test: should strictly mask unauthorized target tables with _accessDenied: true and ZERO leaked fields', async () => {
    const mockRows = [
      {
        id: 1,
        tableId: 10,
        data: {
          field_101: [{ id: 501 }], // links to authorized Table 20
          field_102: [{ id: 601 }, { id: 602 }], // links to UNAUTHORIZED Table 30 (secret table)
        },
      },
    ]

    const mockLinkRowFields = [
      { id: 101, tableId: 10, options: { targetTableId: 20 } },
      { id: 102, tableId: 10, options: { targetTableId: 30 } },
    ]

    // User only has canViewData on Table 10 and Table 20. Table 30 is NOT authorized.
    const authorizedTableIds = new Set([10, 20])

    // Mock DB responses for authorized queries only
    ;(prisma.databaseTable.findMany as jest.Mock).mockResolvedValue([
      { id: 20, name: 'Customers' },
    ])
    ;(prisma.tableField.findMany as jest.Mock).mockResolvedValue([
      { id: 201, tableId: 20, name: 'Customer Name', type: 'text', order: 0 },
      { id: 202, tableId: 20, name: 'Email', type: 'email', order: 1 },
    ])
    ;(prisma.tableRow.findMany as jest.Mock).mockResolvedValue([
      { id: 501, tableId: 20, data: JSON.stringify({ field_201: 'Acme Corp', field_202: 'contact@acme.com' }) },
    ])

    const cardMap = await hydrateRowCards({
      rows: mockRows,
      linkRowFields: mockLinkRowFields,
      authorizedTableIds,
    })

    // 1. Authorized Table 20 Row 501 -> Full Card hydrated
    const card501 = cardMap.get(501)
    expect(card501).toBeDefined()
    expect(card501?._accessDenied).toBe(false)
    expect(card501?.tableName).toBe('Customers')
    expect(card501?.primaryFieldTitle).toBe('Acme Corp')
    expect(card501?.previewFields).toEqual([
      { id: 202, name: 'Email', type: 'email', value: 'contact@acme.com' },
    ])

    // 2. UNAUTHORIZED Table 30 Rows 601 & 602 -> Masked immediately
    const card601 = cardMap.get(601)
    expect(card601).toBeDefined()
    expect(card601?._accessDenied).toBe(true)
    expect(card601?.primaryFieldTitle).toBeUndefined()
    expect(card601?.previewFields).toBeUndefined()
    expect(card601?.tableName).toBeUndefined()

    const card602 = cardMap.get(602)
    expect(card602).toBeDefined()
    expect(card602?._accessDenied).toBe(true)
    expect(card602?.primaryFieldTitle).toBeUndefined()
    expect(card602?.previewFields).toBeUndefined()

    // 3. Critical DB Query Security Assertion:
    // Unauthorized table 30 and row 601, 602 were NEVER queried from DB!
    expect(prisma.databaseTable.findMany).toHaveBeenCalledWith({
      where: { id: { in: [20] }, deletedAt: null },
      select: { id: true, name: true },
    })
    expect(prisma.tableRow.findMany).toHaveBeenCalledWith({
      where: { id: { in: [501] }, deletedAt: null },
      select: { id: true, tableId: true, data: true },
    })
  })
})
