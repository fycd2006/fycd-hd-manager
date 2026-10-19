/**
 * Database Module - Table Load Orchestration
 * Stale-while-revalidate flow for loading a table, independent of React
 */

import { TableLoadError, type TableDataEntry, type tableDataCache } from './tableDataCache'

export interface RunTableLoadDeps {
  cache: Pick<typeof tableDataCache, 'get' | 'load' | 'invalidate'>
  isCurrent: () => boolean
  applyFull: (entry: TableDataEntry) => void
  applyRefresh: (entry: TableDataEntry, viewsChanged: boolean) => void
  setLoading: (loading: boolean) => void
  onError: (error: unknown) => void
}

function sameViews(a: TableDataEntry['views'], b: TableDataEntry['views']): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export async function runTableLoad(
  tableId: number,
  opts: { force?: boolean },
  deps: RunTableLoadDeps
): Promise<'cache-hit' | 'cache-miss'> {
  const { cache, isCurrent, applyFull, applyRefresh, setLoading, onError } = deps
  const cached = cache.get(tableId)

  const handleError = (error: unknown) => {
    if (!isCurrent()) return
    if (error instanceof TableLoadError && (error.status === 403 || error.status === 404)) {
      cache.invalidate(tableId)
      onError(error)
      return
    }
    if (cached) {
      console.warn('Background table refresh failed', error)
      return
    }
    onError(error)
  }

  if (cached) {
    if (!opts.force) applyFull(cached)
    try {
      const fresh = await cache.load(tableId)
      if (isCurrent()) applyRefresh(fresh, !sameViews(cached.views, fresh.views))
    } catch (error) {
      handleError(error)
    }
    return 'cache-hit'
  }

  setLoading(true)
  try {
    const fresh = await cache.load(tableId)
    if (isCurrent()) applyFull(fresh)
  } catch (error) {
    handleError(error)
  } finally {
    if (isCurrent()) setLoading(false)
  }
  return 'cache-miss'
}
