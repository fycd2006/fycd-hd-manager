import {
  buildUnifiedColumns,
  getRowFieldValue,
  computeColumnSummary,
  analyzeFieldFrequencies,
  MasterFieldInfo,
} from '../multiTableUtils'

describe('multiTableUtils - Cross-Table Unified Columns', () => {
  const mockFieldsMap: Record<string, MasterFieldInfo> = {
    field_101: { id: 101, tableId: 1, name: '姓名', type: 'text' },
    field_205: { id: 205, tableId: 2, name: '姓名', type: 'text' },
    field_102: { id: 102, tableId: 1, name: '薪資', type: 'number' },
    field_206: { id: 206, tableId: 2, name: '薪資', type: 'number' },
    field_103: { id: 103, tableId: 1, name: '部門 (北區專屬)', type: 'text' },
  }

  it('buildUnifiedColumns groups fields with the same name across tables into a single column', () => {
    const unified = buildUnifiedColumns(mockFieldsMap)

    expect(unified).toHaveLength(3) // "姓名", "薪資", "部門 (北區專屬)"

    const nameCol = unified.find((c) => c.key === '姓名')
    expect(nameCol).toBeDefined()
    expect(nameCol?.tableFieldMap).toEqual({
      1: 'field_101',
      2: 'field_205',
    })

    const salaryCol = unified.find((c) => c.key === '薪資')
    expect(salaryCol).toBeDefined()
    expect(salaryCol?.type).toBe('number')
    expect(salaryCol?.tableFieldMap).toEqual({
      1: 'field_102',
      2: 'field_206',
    })
  })

  it('getRowFieldValue retrieves value from the correct fieldId based on row tableId', () => {
    const unified = buildUnifiedColumns(mockFieldsMap)
    const unifiedMap = Object.fromEntries(unified.map((c) => [c.key, c]))

    const rowTable1 = {
      tableId: 1,
      data: { field_101: '張三', field_102: 50000, field_103: '研發部' },
    }
    const rowTable2 = {
      tableId: 2,
      data: { field_205: '李四', field_206: 60000 },
    }

    // Both rows should resolve "姓名" without returning undefined or dash
    expect(getRowFieldValue(rowTable1, '姓名', unifiedMap, mockFieldsMap)).toBe('張三')
    expect(getRowFieldValue(rowTable2, '姓名', unifiedMap, mockFieldsMap)).toBe('李四')

    // Both rows should resolve "薪資"
    expect(getRowFieldValue(rowTable1, '薪資', unifiedMap, mockFieldsMap)).toBe(50000)
    expect(getRowFieldValue(rowTable2, '薪資', unifiedMap, mockFieldsMap)).toBe(60000)

    // Table 2 does not have "部門 (北區專屬)"
    expect(
      getRowFieldValue(rowTable2, '部門 (北區專屬)', unifiedMap, mockFieldsMap)
    ).toBeUndefined()
  })

  it('computeColumnSummary aggregates unified columns across different tables', () => {
    const unified = buildUnifiedColumns(mockFieldsMap)
    const unifiedMap = Object.fromEntries(unified.map((c) => [c.key, c]))

    const rows = [
      { tableId: 1, data: { field_101: '張三', field_102: 50000 } },
      { tableId: 2, data: { field_205: '李四', field_206: 70000 } },
      { tableId: 1, data: { field_101: '王五', field_102: 60000 } },
    ]

    const nameSummary = computeColumnSummary(rows, '姓名', unifiedMap, mockFieldsMap)
    expect(nameSummary.count).toBe(3)
    expect(nameSummary.emptyCount).toBe(0)
    expect(nameSummary.uniqueCount).toBe(3)

    const salarySummary = computeColumnSummary(rows, '薪資', unifiedMap, mockFieldsMap)
    expect(salarySummary.count).toBe(3)
    expect(salarySummary.sum).toBe(180000)
    expect(salarySummary.avg).toBe(60000)
    expect(salarySummary.min).toBe(50000)
    expect(salarySummary.max).toBe(70000)
  })

  it('analyzeFieldFrequencies computes coverage based on unified columns', () => {
    const rows = [
      { tableId: 1, data: { field_101: '張三', field_102: 50000, field_103: '研發部' } },
      { tableId: 2, data: { field_205: '李四', field_206: 70000 } },
    ]

    const result = analyzeFieldFrequencies(rows, 15, mockFieldsMap)
    const nameField = result.allFields.find((f) => f.key === '姓名')

    expect(nameField).toBeDefined()
    expect(nameField?.count).toBe(2)
    expect(nameField?.coverageRate).toBe(100)
    expect(nameField?.isSparse).toBe(false)

    const deptField = result.allFields.find((f) => f.key === '部門 (北區專屬)')
    expect(deptField?.count).toBe(1)
    expect(deptField?.coverageRate).toBe(50)
  })

  it('buildUnifiedColumns tracks sources and detects type mismatch when field types differ', () => {
    const mismatchFieldsMap: Record<string, MasterFieldInfo> = {
      field_101: { id: 101, tableId: 1, name: '數值指標', type: 'number' },
      field_205: { id: 205, tableId: 2, name: '數值指標', type: 'text' },
    }

    const unified = buildUnifiedColumns(mismatchFieldsMap, [], { 1: { name: '訂單表' }, 2: { name: '客戶表' } })
    expect(unified).toHaveLength(1)
    const col = unified[0]
    expect(col.name).toBe('數值指標')
    expect(col.hasTypeMismatch).toBe(true)
    expect(col.mismatchedTypes).toEqual(expect.arrayContaining(['number', 'text']))
    expect(col.sources).toHaveLength(2)
    expect(col.sources[0].tableName).toBe('訂單表')
    expect(col.sources[1].tableName).toBe('客戶表')
  })

  it('buildUnifiedColumns supports unmerging fields via unmergedKeys', () => {
    const unified = buildUnifiedColumns(mockFieldsMap, ['姓名'])
    // '姓名' should now be split into individual table fields
    const nameCols = unified.filter((c) => c.name.includes('姓名'))
    expect(nameCols.length).toBe(2)
    expect(nameCols[0].key).toBe('field_101')
    expect(nameCols[1].key).toBe('field_205')
  })

  it('computeColumnSummary calculates excludedMismatchCount for non-numeric values in numeric calculations', () => {
    const rows = [
      { tableId: 1, data: { field_102: 100 } },
      { tableId: 2, data: { field_206: 'abc' } }, // non-numeric mismatch
      { tableId: 1, data: { field_102: 200 } },
    ]
    const unified = buildUnifiedColumns(mockFieldsMap)
    const unifiedMap = Object.fromEntries(unified.map((c) => [c.key, c]))

    const summary = computeColumnSummary(rows, '薪資', unifiedMap, mockFieldsMap)
    expect(summary.count).toBe(3)
    expect(summary.sum).toBe(300)
    expect(summary.avg).toBe(150)
    expect(summary.excludedMismatchCount).toBe(1)
  })

  it('analyzeFieldFrequencies prioritizes pinned keys and exempts them from isSparse', () => {
    const rows = [
      { tableId: 1, data: { field_101: '張三', field_102: 50000, field_103: '研發部' } },
      { tableId: 2, data: { field_205: '李四', field_206: 70000 } },
    ]

    // Dept field has only 50% coverage, but if pinned, it should have isPinned=true, isSparse=false
    const result = analyzeFieldFrequencies(rows, 1, mockFieldsMap, ['部門 (北區專屬)'])
    const deptField = result.allFields.find((f) => f.key === '部門 (北區專屬)')
    expect(deptField?.isPinned).toBe(true)
    expect(deptField?.isSparse).toBe(false)
    expect(result.defaultVisibleKeys).toContain('部門 (北區專屬)')
  })

  it('buildUnifiedColumns supports manual synonym merging via customAliasMap', () => {
    const synonymFieldsMap: Record<string, MasterFieldInfo> = {
      field_101: { id: 101, tableId: 1, name: '姓名', type: 'text' },
      field_205: { id: 205, tableId: 2, name: '顧客姓名', type: 'text' },
    }

    // Map '顧客姓名' or 'field_205' to '姓名'
    const unified = buildUnifiedColumns(synonymFieldsMap, [], undefined, { field_205: '姓名' })
    expect(unified).toHaveLength(1)
    expect(unified[0].key).toBe('姓名')
    expect(unified[0].sources).toHaveLength(2)
    expect(unified[0].tableFieldMap).toEqual({ 1: 'field_101', 2: 'field_205' })
  })

  it('computeColumnSummary tracks excludedRows details for non-numeric values', () => {
    const rows = [
      { id: 11, tableId: 1, data: { field_102: 500 } },
      { id: 22, tableId: 2, data: { field_206: 'N/A' } },
    ]
    const unified = buildUnifiedColumns(mockFieldsMap)
    const unifiedMap = Object.fromEntries(unified.map((c) => [c.key, c]))

    const summary = computeColumnSummary(rows, '薪資', unifiedMap, mockFieldsMap)
    expect(summary.excludedMismatchCount).toBe(1)
    expect(summary.excludedRows).toHaveLength(1)
    expect(summary.excludedRows[0]).toEqual({
      tableId: 2,
      rowId: 22,
      value: 'N/A',
    })
  })

  it('buildUnifiedColumns unmerges both original and aliased fields when unified column name is in unmergedKeys', () => {
    const synonymFieldsMap: Record<string, MasterFieldInfo> = {
      field_101: { id: 101, tableId: 1, name: '姓名', type: 'text' },
      field_205: { id: 205, tableId: 2, name: '顧客姓名', type: 'text' },
    }

    // Map 'field_205' to '姓名', but '姓名' is in unmergedKeys
    const unified = buildUnifiedColumns(synonymFieldsMap, ['姓名'], undefined, { field_205: '姓名' })
    expect(unified).toHaveLength(2)

    const table1Col = unified.find((c) => c.key === 'field_101')
    const table2Col = unified.find((c) => c.key === 'field_205')

    expect(table1Col).toBeDefined()
    expect(table1Col?.name).toBe('姓名 (表 1)')
    expect(table2Col).toBeDefined()
    expect(table2Col?.name).toBe('顧客姓名 (表 2)')
  })
})

