import {
  parseCursor,
  generateCursor,
  sanitizeSortField,
  buildEffectiveFieldSql,
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
    const fieldMap = { 1: { Status: 'field_1', Priority: 'field_2', Score: 'field_3', Note: 'field_4' } }

    // contains
    const containsSql = buildCrossTableFilterSql({ field: 'Status', operator: 'contains', value: 'Active' }, 1, fieldMap)
    expect(containsSql).not.toBeNull()
    expect(containsSql?.strings.join('')).toContain('LIKE')

    // not_contains
    const notContainsSql = buildCrossTableFilterSql({ field: 'Status', operator: 'not_contains', value: 'Draft' }, 1, fieldMap)
    expect(notContainsSql).not.toBeNull()
    expect(notContainsSql?.strings.join('')).toContain('NOT (LOWER')

    // equals & not_equals
    const equalsSql = buildCrossTableFilterSql({ field: 'Priority', operator: 'equals', value: 'High' }, 1, fieldMap)
    expect(equalsSql).not.toBeNull()
    expect(equalsSql?.strings.join('')).toContain('=')

    const notEqualsSql = buildCrossTableFilterSql({ field: 'Priority', operator: 'not_equals', value: 'Low' }, 1, fieldMap)
    expect(notEqualsSql).not.toBeNull()
    expect(notEqualsSql?.strings.join('')).toContain('<>')

    // higher_than & lower_than
    const higherThanSql = buildCrossTableFilterSql({ field: 'Score', operator: 'higher_than', value: '100' }, 1, fieldMap)
    expect(higherThanSql).not.toBeNull()
    expect(higherThanSql?.strings.join('')).toContain('CAST')

    const lowerThanSql = buildCrossTableFilterSql({ field: 'Score', operator: 'lower_than', value: '50' }, 1, fieldMap)
    expect(lowerThanSql).not.toBeNull()
    expect(lowerThanSql?.strings.join('')).toContain('<')

    // is_empty & is_not_empty
    const isEmptySql = buildCrossTableFilterSql({ field: 'Note', operator: 'is_empty' }, 1, fieldMap)
    expect(isEmptySql).not.toBeNull()
    expect(isEmptySql?.strings.join('')).toContain('IS NULL')

    const isNotEmptySql = buildCrossTableFilterSql({ field: 'Note', operator: 'is_not_empty' }, 1, fieldMap)
    expect(isNotEmptySql).not.toBeNull()
    expect(isNotEmptySql?.strings.join('')).toContain('IS NOT NULL')
  })

  it('handles invalid filter rules safely', () => {
    expect(buildCrossTableFilterSql(null as any)).toBeNull()
    expect(buildCrossTableFilterSql({ field: '', operator: 'equals' as any })).toBeNull()
    expect(buildCrossTableFilterSql({ field: 'field_1', operator: 'invalid_op' as any })).toBeNull()
    expect(buildCrossTableFilterSql({ field: 'field_1', operator: 'higher_than', value: 'not-a-number' })).toBeNull()
  })

  it('passes filters down into getMultiTableRows SQL query', async () => {
    const mockRaw = [
      { id: 10, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 'Open' }) },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockRaw)

    const res = await getMultiTableRows({
      tableIds: [1, 2],
      filters: [
        { field: 'field_1', operator: 'equals', value: 'Open' },
        { field: 'field_2', operator: 'higher_than', value: '80' },
      ],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].data.field_1).toBe('Open')
  })
})

describe('Phase 1: buildEffectiveFieldSql Abstraction & Security Tests', () => {
  it('generates fallback COALESCE without masterViewId', () => {
    const sql = buildEffectiveFieldSql('field_10')
    expect(sql).not.toBeNull()
    const sqlText = sql?.strings.join('')
    expect(sqlText).toContain('JSON_EXTRACT')
    expect(sqlText).toContain('$."field_10"')
    expect(sqlText).not.toContain('overrides')
  })

  it('generates COALESCE(override, base, "") with masterViewId', () => {
    const sql = buildEffectiveFieldSql({
      fieldKey: 'field_10',
      masterViewId: 42,
      tableAlias: 'r',
      overrideAlias: 'o',
    })
    expect(sql).not.toBeNull()
    const sqlText = sql?.strings.join('')
    expect(sqlText).toContain('COALESCE')
    expect(sqlText).toContain('JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(o.overrides), \'$."field_10"\'))')
    expect(sqlText).toContain('JSON_UNQUOTE(JSON_EXTRACT(JSON_UNQUOTE(r.data), \'$."field_10"\'))')
  })

  it('handles system fields correctly with alias', () => {
    const createdAtSql = buildEffectiveFieldSql({ fieldKey: 'createdAt', masterViewId: 1, tableAlias: 'r' })
    expect(createdAtSql?.strings.join('')).toContain('r.createdAt')

    const idSql = buildEffectiveFieldSql({ fieldKey: 'id', masterViewId: 1, tableAlias: 'r' })
    expect(idSql?.strings.join('')).toContain('r.id')

    const tableIdSql = buildEffectiveFieldSql({ fieldKey: 'tableId', masterViewId: 1, tableAlias: 'r' })
    expect(tableIdSql?.strings.join('')).toContain('r.tableId')
  })

  it('Reinforcement 1 (Security): rejects invalid field keys and SQL injection payloads safely', () => {
    // Malicious SQL injection payloads
    expect(buildEffectiveFieldSql('field_10"; DROP TABLE TableRow;--')).toBeNull()
    expect(buildEffectiveFieldSql("field_10' OR 1=1 --")).toBeNull()
    expect(buildEffectiveFieldSql('field_abc')).toBeNull()
    expect(buildEffectiveFieldSql('field_')).toBeNull()
    expect(buildEffectiveFieldSql('custom_column')).toBeNull()
    expect(buildEffectiveFieldSql('')).toBeNull()
    expect(buildEffectiveFieldSql(null as any)).toBeNull()
  })

  it('Whitelist Authorization: rejects syntactically valid fieldKey when numeric fieldId is not in allowedFieldIds', () => {
    // field_999 is 100% syntactically valid, but field ID 999 is not in the whitelist [10, 20]
    const allowedSet = new Set([10, 20])
    expect(buildEffectiveFieldSql({ fieldKey: 'field_10', allowedFieldIds: allowedSet })).not.toBeNull()
    expect(buildEffectiveFieldSql({ fieldKey: 'field_20', allowedFieldIds: allowedSet })).not.toBeNull()

    // Must be rejected safely (returns null)
    expect(buildEffectiveFieldSql({ fieldKey: 'field_999', allowedFieldIds: allowedSet })).toBeNull()

    // Also works with array of numbers or strings
    const allowedArray = [10, 20]
    expect(buildEffectiveFieldSql({ fieldKey: 'field_999', allowedFieldIds: allowedArray })).toBeNull()
    expect(buildEffectiveFieldSql({ fieldKey: 'field_10', allowedFieldIds: allowedArray })).not.toBeNull()
  })

  it('Reinforcement 2 (Single JOIN): multi-field filtering shares the single override table alias without duplicate JOINs', () => {
    const allowed = new Set([101, 102, 103])
    const masterViewId = 77

    // Build filter expressions for 3 fields simultaneously
    const filter1 = buildCrossTableFilterSql(
      { field: 'field_101', operator: 'contains', value: 'Alpha' },
      1,
      undefined,
      masterViewId,
      allowed
    )
    const filter2 = buildCrossTableFilterSql(
      { field: 'field_102', operator: 'higher_than', value: '100' },
      1,
      undefined,
      masterViewId,
      allowed
    )
    const filter3 = buildCrossTableFilterSql(
      { field: 'field_103', operator: 'equals', value: 'Active' },
      1,
      undefined,
      masterViewId,
      allowed
    )

    expect(filter1).not.toBeNull()
    expect(filter2).not.toBeNull()
    expect(filter3).not.toBeNull()

    // All filters must uniformly reference the shared aliases 'o.overrides' and 'r.data'
    expect(filter1?.strings.join('')).toContain('o.overrides')
    expect(filter1?.strings.join('')).toContain('r.data')
    expect(filter2?.strings.join('')).toContain('o.overrides')
    expect(filter2?.strings.join('')).toContain('r.data')
    expect(filter3?.strings.join('')).toContain('o.overrides')
    expect(filter3?.strings.join('')).toContain('r.data')
  })
})

describe('Phase 2: MasterViewOverride WHERE Pushdown Scenarios (A/B/C/D)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('場景A: 某列原始值不符合篩選條件，但該列有 Override 且 Override 後的值符合篩選條件 → 查詢結果必須包含這一列', async () => {
    // Row 101 original data has field_1: 'Pending' (does NOT match 'Active')
    // But Override has field_1: 'Active'
    // Under Phase 2 SQL pushdown, COALESCE(o.overrides->>'$.field_1', r.data->>'$.field_1') evaluates to 'Active'
    const mockReturnedRow = [
      {
        id: 101,
        tableId: 1,
        createdAt: new Date('2026-01-01'),
        data: JSON.stringify({ field_1: 'Pending' }),
      },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRow)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Active' }],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify SQL includes LEFT JOIN MasterViewOverride and COALESCE pushdown
    expect(sqlString).toContain('LEFT JOIN MasterViewOverride o')
    expect(sqlString).toContain('o.masterViewId = ?')
    expect(sqlString).toContain('COALESCE')
    expect(sqlString).toContain('o.overrides')
    expect(sqlString).toContain('r.data')

    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(101)
  })

  it('場景B: 某列原始值符合篩選條件，但該列有 Override 且 Override 後的值變成不符合 → 查詢結果必須排除這一列', async () => {
    // Row 102 original data has field_1: 'Active' (matches 'Active')
    // But Override changed field_1 to 'Archived' (does NOT match 'Active')
    // Under Phase 2 SQL pushdown, COALESCE('Archived', 'Active') = 'Archived', so SQL filter excludes it -> 0 rows returned
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Active' }],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify SQL checks COALESCE(o.overrides, r.data) which successfully filtered out the row at DB layer
    expect(sqlString).toContain('COALESCE')
    expect(sqlString).toContain('o.overrides')
    expect(res.rows).toHaveLength(0)
  })

  it('場景C: 完全沒有 Override 的列，篩選行為與原始資料完全一致', async () => {
    // Rows without override fall back to r.data via COALESCE(null, r.data)
    const mockReturnedRow = [
      {
        id: 103,
        tableId: 1,
        createdAt: new Date('2026-01-01'),
        data: JSON.stringify({ field_1: 'Active' }),
      },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRow)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      filters: [{ field: 'field_1', operator: 'equals', value: 'Active' }],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(103)
    expect(res.rows[0].data.field_1).toBe('Active')
  })

  it('場景C-2: 某列存在 MasterViewOverride 記錄（覆寫了其他欄位 field_1），但篩選的欄位（field_2）未被覆寫 → 應正確 fallback 到 r.data 原始值並成功命中', async () => {
    // Row 104 has:
    // r.data = { field_1: "Original Title", field_2: 100 }
    // o.overrides = { field_1: "Overridden Title" } (field_2 is NOT in overrides)
    // Filter is: field_2 higher_than 50
    // In SQL: JSON_EXTRACT(o.overrides, '$."field_2"') evaluates to NULL,
    // so COALESCE(NULL, r.data->>'$.field_2') = '100'. CAST('100' AS DECIMAL) > 50 -> TRUE!
    const mockReturnedRow = [
      {
        id: 104,
        tableId: 1,
        createdAt: new Date('2026-01-01'),
        data: JSON.stringify({ field_1: 'Original Title', field_2: 100 }),
      },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRow)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      filters: [{ field: 'field_2', operator: 'higher_than', value: '50' }],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify SQL generated utilizes COALESCE for field_2 extraction
    expect(sqlString).toContain('COALESCE')
    expect(sqlString).toContain('$."field_2"')
    expect(sqlString).toContain('o.overrides')
    expect(sqlString).toContain('r.data')
    expect(sqlString).toContain('CAST')

    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(104)
    expect(res.rows[0].data.field_2).toBe(100)
  })

  it('場景D: 無 masterViewId 的查詢路徑，SQL 絕不包含 LEFT JOIN MasterViewOverride', async () => {
    // When masterViewId is null / undefined / not passed
    const mockReturnedRow = [
      {
        id: 105,
        tableId: 1,
        createdAt: new Date('2026-01-01'),
        data: JSON.stringify({ field_1: 'Active' }),
      },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRow)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: null, // explicit null
      filters: [{ field: 'field_1', operator: 'equals', value: 'Active' }],
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Must NOT contain any LEFT JOIN MasterViewOverride or override aliases
    expect(sqlString).not.toContain('MasterViewOverride')
    expect(sqlString).not.toContain('o.overrides')
    expect(sqlString).toContain('FROM TableRow r WHERE r.tableId = ?')

    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(105)
  })
})

describe('Phase 3: MasterViewOverride ORDER BY & Keyset Cursor Scenarios (E/F/G)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('場景E: 某列因為 Override 導致排序值改變（原始值 10，Override 後 500），排序 SQL 與結果正確反映 Override 後的值', async () => {
    // Row 1 (raw 10, override 500), Row 2 (raw 20, no override)
    // When sorting field_1 ASC, SQL evaluates sort_val via COALESCE, so Row 2 (20) < Row 1 (500)
    const mockReturnedRows = [
      { id: 2, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 20 }), sort_val: '20' },
      { id: 1, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 10 }), sort_val: '500' },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRows)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      sortField: 'field_1',
      sortOrder: 'asc',
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify sort_val expression uses COALESCE with override extract
    expect(sqlString).toContain('COALESCE')
    expect(sqlString).toContain('o.overrides')
    expect(sqlString).toContain('r.data')
    expect(sqlString).toContain('$."field_1"')
    expect(sqlString).toContain('AS sort_val')
    expect(sqlString).toContain('ORDER BY sort_val ASC')

    expect(res.rows).toHaveLength(2)
    expect(res.rows[0].id).toBe(2)
    expect(res.rows[1].id).toBe(1)
  })

  it('場景F: 翻頁時，游標基準值落在有 Override 的列上，generateCursor 與 Keyset 條件能精確以 Override 有效值定位下一頁', async () => {
    // Last row of Page 1 has override sort_val: '500' (raw was 10)
    const lastRow = {
      id: 1,
      tableId: 1,
      createdAt: new Date('2026-01-01'),
      data: { field_1: 10 },
      sort_val: '500', // effective value from SQL
    }

    // 1. generateCursor must encode the effective value "500", not raw 10
    const cursor = generateCursor(lastRow as any, 'field_1', 'asc')
    expect(cursor).toBeTruthy()

    // Verify parsed cursor
    const parsed = parseCursor(cursor)
    expect(parsed?.sortField).toBe('field_1')
    expect(parsed?.sortValue).toBe('500')
    expect(parsed?.rowId).toBe(1)

    // 2. Query Page 2 with this cursor
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 3, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 600 }), sort_val: '600' },
    ])

    const resPage2 = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      sortField: 'field_1',
      sortOrder: 'asc',
      cursor,
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify Keyset cursor WHERE condition checks sort_val with robust expanded comparison
    expect(sqlString).toContain('WHERE (sort_val > ?) OR (sort_val = ? AND tableId > ?) OR (sort_val = ? AND tableId = ? AND id > ?)')
    expect(resPage2.rows).toHaveLength(1)
    expect(resPage2.rows[0].id).toBe(3)
  })

  it('場景G: 混合情境 — 多列中部分有 Override、部分無 Override，整體相對排序與資料順序完整正確', async () => {
    // 4 rows:
    // Row 1: raw 10, no override -> effective 10
    // Row 2: raw 40, override 15 -> effective 15
    // Row 3: raw 25, no override -> effective 25
    // Row 4: raw 30, override 50 -> effective 50
    // Expected sorted order (ASC): Row 1 (10) -> Row 2 (15) -> Row 3 (25) -> Row 4 (50)
    const mockReturnedRows = [
      { id: 1, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 10 }), sort_val: '10' },
      { id: 2, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 40 }), sort_val: '15' },
      { id: 3, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 25 }), sort_val: '25' },
      { id: 4, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_1: 30 }), sort_val: '50' },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRows)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      sortField: 'field_1',
      sortOrder: 'asc',
      limit: 10,
    })

    expect(res.rows.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(res.rows.map((r) => (r as any).sort_val)).toEqual(['10', '15', '25', '50'])
  })

  it('場景H (數字欄位排序): 當 sortFieldType 為 number 時，SQL 生成 CAST AS DECIMAL 並依數值大小排序', async () => {
    // Unpadded numeric rows: 5, 20, 50, 300, 800
    const mockReturnedRows = [
      { id: 1, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_2: 100 }), sort_val: 5 },
      { id: 2, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_2: 20 }), sort_val: 20 },
      { id: 3, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_2: 50 }), sort_val: 50 },
      { id: 5, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_2: 10 }), sort_val: 300 },
      { id: 6, tableId: 1, createdAt: new Date('2026-01-01'), data: JSON.stringify({ field_2: 800 }), sort_val: 800 },
    ]
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue(mockReturnedRows)

    const res = await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      sortField: 'field_2',
      sortOrder: 'asc',
      sortFieldType: 'number',
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify sort_val contains safe regex check and CAST AS DECIMAL
    expect(sqlString).toContain("REGEXP '^-?[0-9]+(\\.[0-9]+)?$'")
    expect(sqlString).toContain('AS DECIMAL(30,10))')
    expect(sqlString).toContain('ORDER BY (sort_val IS NULL) ASC, sort_val ASC')

    expect(res.rows.map((r) => r.id)).toEqual([1, 2, 3, 5, 6])
    expect(res.rows.map((r) => (r as any).sort_val)).toEqual([5, 20, 50, 300, 800])
  })

  it('場景I (fieldTypeMap 缺失安全預設): 當未傳入 sortFieldType 或 fieldTypeMap 缺失時，安全 fallback 為字串排序（無 CAST/REGEXP）', async () => {
    ;(prisma.$queryRaw as jest.Mock).mockResolvedValue([])

    await getMultiTableRows({
      tableIds: [1],
      masterViewId: 10,
      sortField: 'field_unknown',
      sortOrder: 'asc',
      // sortFieldType and fieldTypeMap are omitted
      limit: 10,
    })

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)
    const sqlObj = (prisma.$queryRaw as jest.Mock).mock.calls[0][0]
    const sqlString = (sqlObj.strings || []).join('?')

    // Verify it does NOT contain CAST AS DECIMAL or REGEXP
    expect(sqlString).not.toContain('AS DECIMAL(30,10))')
    expect(sqlString).not.toContain('REGEXP')
    // Standard string ORDER BY
    expect(sqlString).toContain('ORDER BY sort_val ASC')
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


