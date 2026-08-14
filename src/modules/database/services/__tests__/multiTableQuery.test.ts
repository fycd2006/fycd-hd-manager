import {
  parseCursor,
  generateCursor,
  sanitizeSortField,
  buildCrossTableFilterSql,
  getMultiTableRows,
  computeColumnSummary,
  analyzeFieldFrequencies,
} from '../multiTableQuery'
import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: jest.fn(),
  },
}))

describe('multiTableQuery cursor serialization & dynamic sorting (Phase 4.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('encodes and decodes default createdAt cursor seamlessly (round-trip)', () => {
    const row = {
      id: 999,
      tableId: 42,
      createdAt: new Date('2026-08-13T10:15:30.123Z'),
      data: { Title: 'Task 1' },
    }

    const cursorStr = generateCursor(row, 'createdAt', 'desc')

    const decoded = parseCursor(cursorStr)
    expect(decoded).not.toBeNull()
    expect(decoded?.sortField).toBe('createdAt')
    expect(decoded?.sortOrder).toBe('desc')
    expect(decoded?.sortValue).toBeInstanceOf(Date)
    expect(decoded?.sortValue.getTime()).toBe(row.createdAt.getTime())
    expect(decoded?.tableId).toBe(row.tableId)
    expect(decoded?.rowId).toBe(row.id)
  })

  it('encodes and decodes dynamic column cursor seamlessly (e.g. Title ASC)', () => {
    const row = {
      id: 105,
      tableId: 2,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      data: { Title: 'Important Meeting', Priority: 'High' },
    }

    const cursorStr = generateCursor(row, 'Title', 'asc')

    const decoded = parseCursor(cursorStr)
    expect(decoded).not.toBeNull()
    expect(decoded?.sortField).toBe('Title')
    expect(decoded?.sortOrder).toBe('asc')
    expect(decoded?.sortValue).toBe('Important Meeting')
    expect(decoded?.tableId).toBe(2)
    expect(decoded?.rowId).toBe(105)
  })

  it('produces only URL-safe characters (no +, /, = in base64url)', () => {
    const problematicRows = [
      { id: 16777215, tableId: 65535, createdAt: new Date('2026-12-31T23:59:59.999Z'), data: {} },
      { id: 1, tableId: 1, createdAt: new Date('1970-01-01T00:00:00.000Z'), data: {} },
      { id: 88888888, tableId: 99999, createdAt: new Date('2099-06-15T12:30:45.678Z'), data: {} },
    ]

    for (const row of problematicRows) {
      const cursorStr = generateCursor(row)
      expect(cursorStr).not.toMatch(/[+/=]/)

      const decoded = parseCursor(cursorStr)
      expect(decoded).not.toBeNull()
      expect(decoded?.tableId).toBe(row.tableId)
      expect(decoded?.rowId).toBe(row.id)
    }
  })

  it('sanitizes sort field names against SQL injection', () => {
    expect(sanitizeSortField('createdAt')).toBe('createdAt')
    expect(sanitizeSortField('id')).toBe('id')
    expect(sanitizeSortField('Title')).toBe('Title')
    expect(sanitizeSortField('field_123')).toBe('field_123')
    expect(sanitizeSortField('Robert"; DROP TABLE TableRow;--')).toBe('Robert DROP TABLE TableRow--')
    expect(sanitizeSortField(null)).toBe('createdAt')
    expect(sanitizeSortField('')).toBe('createdAt')
  })

  it('queries multi-table rows with dynamic sorting SQL', async () => {
    const mockRaw = [
      { id: 1, tableId: 10, createdAt: new Date('2026-01-01'), data: JSON.stringify({ Title: 'A' }) },
      { id: 2, tableId: 10, createdAt: new Date('2026-01-02'), data: JSON.stringify({ Title: 'B' }) },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRaw)

    const res = await getMultiTableRows({
      tableIds: [10, 20],
      sortField: 'Title',
      sortOrder: 'asc',
      limit: 2,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0].data.Title).toBe('A')
    expect(res.nextCursor).not.toBeNull()

    const parsedNext = parseCursor(res.nextCursor!)
    expect(parsedNext?.sortField).toBe('Title')
    expect(parsedNext?.sortOrder).toBe('asc')
    expect(parsedNext?.sortValue).toBe('B')
  })

  it('handles Chinese Unicode and special character sortField seamlessly', async () => {
    const mockRaw = [
      { id: 1, tableId: 10, createdAt: new Date('2026-01-01'), data: JSON.stringify({ 成全負責關係表: '負責人 A' }) },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRaw)

    const res = await getMultiTableRows({
      tableIds: [10],
      sortField: '成全負責關係表',
      sortOrder: 'asc',
      limit: 1,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].data.成全負責關係表).toBe('負責人 A')
  })

  it('returns empty array when tableIds is empty', async () => {
    const res = await getMultiTableRows({ tableIds: [] })
    expect(res.rows).toEqual([])
    expect(res.nextCursor).toBeNull()
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
})


describe('multiTableQuery dynamic SQL filtering pushdown (Phase 4.2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds SQL fragments for various filter operators', () => {
    // contains
    const containsSql = buildCrossTableFilterSql({ field: 'Status', operator: 'contains', value: 'Active' })
    expect(containsSql).not.toBeNull()
    expect(containsSql?.strings.join('')).toContain('LIKE')

    // not_contains
    const notContainsSql = buildCrossTableFilterSql({ field: 'Status', operator: 'not_contains', value: 'Draft' })
    expect(notContainsSql).not.toBeNull()
    expect(notContainsSql?.strings.join('')).toContain('NOT (LOWER')

    // equals & not_equals
    const equalsSql = buildCrossTableFilterSql({ field: 'Priority', operator: 'equals', value: 'High' })
    expect(equalsSql).not.toBeNull()
    expect(equalsSql?.strings.join('')).toContain('=')

    const notEqualsSql = buildCrossTableFilterSql({ field: 'Priority', operator: 'not_equals', value: 'Low' })
    expect(notEqualsSql).not.toBeNull()
    expect(notEqualsSql?.strings.join('')).toContain('<>')

    // higher_than & lower_than
    const higherThanSql = buildCrossTableFilterSql({ field: 'Score', operator: 'higher_than', value: '100' })
    expect(higherThanSql).not.toBeNull()
    expect(higherThanSql?.strings.join('')).toContain('CAST')

    const lowerThanSql = buildCrossTableFilterSql({ field: 'Score', operator: 'lower_than', value: '50' })
    expect(lowerThanSql).not.toBeNull()
    expect(lowerThanSql?.strings.join('')).toContain('<')

    // is_empty & is_not_empty
    const isEmptySql = buildCrossTableFilterSql({ field: 'Note', operator: 'is_empty' })
    expect(isEmptySql).not.toBeNull()
    expect(isEmptySql?.strings.join('')).toContain('IS NULL')

    const isNotEmptySql = buildCrossTableFilterSql({ field: 'Note', operator: 'is_not_empty' })
    expect(isNotEmptySql).not.toBeNull()
    expect(isNotEmptySql?.strings.join('')).toContain('IS NOT NULL')
  })

  it('handles invalid filter rules safely', () => {
    expect(buildCrossTableFilterSql(null as any)).toBeNull()
    expect(buildCrossTableFilterSql({ field: '', operator: 'equals' as any })).toBeNull()
    expect(buildCrossTableFilterSql({ field: 'Status', operator: 'invalid_op' as any })).toBeNull()
    expect(buildCrossTableFilterSql({ field: 'Score', operator: 'higher_than', value: 'not-a-number' })).toBeNull()
  })

  it('passes filters down into getMultiTableRows SQL query', async () => {
    const mockRaw = [
      { id: 10, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ Status: 'Open' }) },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRaw)

    const res = await getMultiTableRows({
      tableIds: [1, 2],
      filters: [
        { field: 'Status', operator: 'equals', value: 'Open' },
        { field: 'Score', operator: 'higher_than', value: '80' },
      ],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].data.Status).toBe('Open')
  })
})

describe('multiTableQuery column aggregation summary (Phase 4.3)', () => {
  it('computes aggregation metrics correctly for numeric columns', () => {
    const rows = [
      { data: { Amount: 100 } },
      { data: { Amount: '200' } },
      { data: { Amount: 300 } },
      { data: { Amount: null } },
      { data: { Amount: '' } },
    ]

    const summary = computeColumnSummary(rows, 'Amount')

    expect(summary.count).toBe(3)
    expect(summary.emptyCount).toBe(2)
    expect(summary.percentFilled).toBe(60) // 3 / 5 = 60%
    expect(summary.sum).toBe(600)
    expect(summary.avg).toBe(200)
    expect(summary.min).toBe(100)
    expect(summary.max).toBe(300)
    expect(summary.uniqueCount).toBe(3)
  })

  it('computes aggregation metrics correctly for string columns', () => {
    const rows = [
      { data: { Status: 'Done' } },
      { data: { Status: 'In Progress' } },
      { data: { Status: 'Done' } },
      { data: { Status: '' } },
    ]

    const summary = computeColumnSummary(rows, 'Status')

    expect(summary.count).toBe(3)
    expect(summary.emptyCount).toBe(1)
    expect(summary.percentFilled).toBe(75) // 3 / 4 = 75%
    expect(summary.sum).toBeNull()
    expect(summary.avg).toBeNull()
    expect(summary.uniqueCount).toBe(2) // 'Done', 'In Progress'
  })

  it('handles empty rows gracefully', () => {
    const summary = computeColumnSummary([], 'Amount')

    expect(summary.count).toBe(0)
    expect(summary.emptyCount).toBe(0)
    expect(summary.percentFilled).toBe(0)
    expect(summary.sum).toBeNull()
    expect(summary.avg).toBeNull()
    expect(summary.min).toBeNull()
    expect(summary.max).toBeNull()
    expect(summary.uniqueCount).toBe(0)
  })
})

describe('multiTableQuery field frequency analysis & sparse mode (Phase 4.4)', () => {
  it('analyzes field frequency and identifies sparse columns based on maxLimit', () => {
    const rows = [
      { data: { Title: 'A', Status: 'Done', Priority: 'High', CustomA: '1' } },
      { data: { Title: 'B', Status: 'Done', Priority: 'Medium', CustomB: '2' } },
      { data: { Title: 'C', Status: 'Pending', ExtraField: 'X' } },
      { data: { Title: 'D' } },
    ]

    // Set maxLimit to 2 columns
    const analysis = analyzeFieldFrequencies(rows, 2)

    // Total fields: Title (4), Status (3), Priority (2), CustomA (1), CustomB (1), ExtraField (1)
    expect(analysis.allFields[0].key).toBe('Title')
    expect(analysis.allFields[0].count).toBe(4)
    expect(analysis.allFields[0].coverageRate).toBe(100)
    expect(analysis.allFields[0].isSparse).toBe(false)

    expect(analysis.allFields[1].key).toBe('Status')
    expect(analysis.allFields[1].count).toBe(3)
    expect(analysis.allFields[1].coverageRate).toBe(75)
    expect(analysis.allFields[1].isSparse).toBe(false)

    // With maxLimit = 2:
    expect(analysis.defaultVisibleKeys).toEqual(['Title', 'Status'])
    expect(analysis.sparseKeys).toHaveLength(4)
    expect(analysis.sparseKeys).toContain('Priority')
    expect(analysis.sparseKeys).toContain('CustomA')
  })

  it('handles empty rows in field frequency analysis', () => {
    const analysis = analyzeFieldFrequencies([], 5)
    expect(analysis.allFields).toEqual([])
    expect(analysis.defaultVisibleKeys).toEqual([])
    expect(analysis.sparseKeys).toEqual([])
  })
})


