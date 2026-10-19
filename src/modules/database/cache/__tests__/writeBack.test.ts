import { buildWriteBackEntry, type TableSnapshot } from '../writeBack'
import type { TableDataEntry } from '../tableDataCache'
import type { PendingOperation } from '../../hooks/useTableOperations'
import type { TableField, TableRow, TableView } from '../../types'

const row = (id: number) => ({ id, data: {} }) as unknown as TableRow
const fields = [{ id: 1 }] as unknown as TableField[]
const views = [{ id: 1 }] as unknown as TableView[]

const cached: TableDataEntry = { fields: [], rows: [], views: [], fetchedAt: 1234 }

function snapshot(overrides: Partial<TableSnapshot> = {}): TableSnapshot {
  return {
    tableId: 7,
    dataTableId: 7,
    fields,
    rows: [row(1), row(2), row(3), row(4)],
    views,
    operations: [],
    ...overrides,
  }
}

const move = (overrides: Partial<PendingOperation>): PendingOperation => ({
  id: 'op',
  type: 'move',
  status: 'staged',
  createdAt: 0,
  tableId: 7,
  ...overrides,
})

describe('buildWriteBackEntry', () => {
  it('writes the on-screen data back, keeping the cached fetchedAt', () => {
    const s = snapshot()
    expect(buildWriteBackEntry(s, cached)).toEqual({
      fields,
      rows: s.rows,
      views,
      fetchedAt: 1234,
    })
  })

  it('excludes rows of staged moves by rowIds and sourceRowIds', () => {
    const s = snapshot({
      operations: [
        move({ rowIds: [1] }),
        move({ id: 'op2', sourceRowIds: [3] }),
        // Not staged, or from another table: kept
        move({ id: 'op3', status: 'pending', rowIds: [2] }),
        move({ id: 'op4', tableId: 8, rowIds: [4] }),
      ],
    })
    expect(buildWriteBackEntry(s, cached)?.rows.map(r => r.id)).toEqual([2, 4])
  })

  it('does not write back without a cache entry', () => {
    expect(buildWriteBackEntry(snapshot(), undefined)).toBeNull()
  })

  it('does not write back when the data belongs to another table', () => {
    // First commit after switching to 7: the rows on screen are still the previous table's
    expect(buildWriteBackEntry(snapshot({ dataTableId: 3 }), cached)).toBeNull()
    expect(buildWriteBackEntry(snapshot({ dataTableId: null }), cached)).toBeNull()
  })

  it('does not write back without a table', () => {
    expect(buildWriteBackEntry(snapshot({ tableId: null, dataTableId: null }), cached)).toBeNull()
    expect(buildWriteBackEntry(null, cached)).toBeNull()
  })
})
