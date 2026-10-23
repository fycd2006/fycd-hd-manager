/**
 * Database Module - Cache Write-Back
 * Builds the cache entry written back for a table when switching away from it
 */

import type { TableDataEntry } from './tableDataCache'
import type { PendingOperation } from '../hooks/useTableOperations'
import type { TableField, TableRow, TableView } from '../types'

export interface TableSnapshot {
  /** Table active when the snapshot was taken */
  tableId: number | null
  /** Table whose completed load produced fields/rows/views (lags tableId right after a switch) */
  dataTableId: number | null
  fields: TableField[]
  rows: TableRow[]
  views: TableView[]
  operations: PendingOperation[]
}

/**
 * Returns the entry to cache for the snapshot's table, or null when nothing should be written:
 * no table, no existing cache entry, or data that does not belong to that table yet.
 * Rows staged to move out of the table are left out; fetchedAt stays the cached one.
 */
export function buildWriteBackEntry(
  snapshot: TableSnapshot | null,
  cachedEntry: TableDataEntry | undefined
): TableDataEntry | null {
  if (!snapshot?.tableId || !cachedEntry) return null
  if (snapshot.dataTableId !== snapshot.tableId) return null

  const stagedMoveRowIds = new Set<number>()
  snapshot.operations.forEach(op => {
    if (op.tableId === snapshot.tableId && op.status === 'staged' && op.type === 'move') {
      op.rowIds?.forEach(id => stagedMoveRowIds.add(id))
      op.sourceRowIds?.forEach(id => stagedMoveRowIds.add(id))
    }
  })

  return {
    fields: snapshot.fields,
    rows: snapshot.rows.filter(r => !stagedMoveRowIds.has(r.id)),
    views: snapshot.views,
    fetchedAt: cachedEntry.fetchedAt,
  }
}
