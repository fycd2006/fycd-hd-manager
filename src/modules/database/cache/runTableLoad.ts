/**
 * Database Module - Table Load Orchestration
 * Stale-while-revalidate flow for loading a table, independent of React
 */

import { TableLoadError, type TableDataEntry, type tableDataCache } from './tableDataCache'

export type TableLoadResult = 'cache-hit' | 'cache-miss' | 'stale'

export interface RunTableLoadDeps {
  cache: Pick<typeof tableDataCache, 'get' | 'load' | 'invalidate'>
  isCurrent: () => boolean
  applyFull: (entry: TableDataEntry) => void
  applyRefresh: (entry: TableDataEntry, viewsChanged: boolean) => void
  setLoading: (loading: boolean) => void
  onError: (error: unknown) => void
  /** Local row writes; a refresh is discarded if any write began, ended or is still running meanwhile */
  writes?: { snapshot(): number; inFlight(): number }
}

function sameViews(a: TableDataEntry['views'], b: TableDataEntry['views']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export async function runTableLoad(
  tableId: number,
  opts: { force?: boolean },
  deps: RunTableLoadDeps
): Promise<TableLoadResult> {
  const { cache, isCurrent, applyFull, applyRefresh, setLoading, onError, writes } = deps
  const cached = cache.get(tableId)
  const fresh = !!opts.force

  const handleError = (error: unknown) => {
    if (!isCurrent()) return
    if (error instanceof TableLoadError && (error.status === 403 || error.status === 404)) {
      cache.invalidate(tableId)
      onError(error)
      return
    }
    if (cached || fresh) {
      console.warn('Background table refresh failed', error)
      return
    }
    onError(error)
  }

  // force refreshes the table already on screen, even if its cache entry was evicted or invalidated:
  // no skeleton and no re-applied view; without an entry to compare against, only the views are reset
  if (cached || fresh) {
    if (cached && !fresh) applyFull(cached)
    // The screen is editable now: a server snapshot taken around a local write may predate it
    const writeSeq = writes?.snapshot()
    try {
      const result = await cache.load(tableId, { fresh })
      if (writes && (writes.snapshot() !== writeSeq || writes.inFlight() > 0)) return 'stale'
      if (isCurrent()) applyRefresh(result, !cached || !sameViews(cached.views, result.views))
    } catch (error) {
      handleError(error)
    }
    return cached ? 'cache-hit' : 'cache-miss'
  }

  setLoading(true)
  try {
    const result = await cache.load(tableId, { fresh })
    if (isCurrent()) applyFull(result)
  } catch (error) {
    handleError(error)
  } finally {
    if (isCurrent()) setLoading(false)
  }
  return 'cache-miss'
}
