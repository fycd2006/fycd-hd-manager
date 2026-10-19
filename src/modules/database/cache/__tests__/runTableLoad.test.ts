import { runTableLoad, type RunTableLoadDeps } from '../runTableLoad'
import { TableLoadError, type TableDataEntry } from '../tableDataCache'
import type { TableView } from '../../types'

const view = (id: number) => ({ id }) as unknown as TableView

function entry(views: TableView[] = [], tag = 'x'): TableDataEntry {
  return {
    fields: [],
    rows: [{ id: tag }] as unknown as TableDataEntry['rows'],
    views,
    fetchedAt: 0,
  }
}

function makeDeps(opts: {
  cached?: TableDataEntry
  load?: () => Promise<TableDataEntry>
  isCurrent?: () => boolean
}) {
  const deps = {
    cache: {
      get: jest.fn(() => opts.cached),
      load: jest.fn(opts.load ?? (() => Promise.resolve(entry()))),
      invalidate: jest.fn(),
    },
    isCurrent: jest.fn(opts.isCurrent ?? (() => true)),
    applyFull: jest.fn(),
    applyRefresh: jest.fn(),
    setLoading: jest.fn(),
    onError: jest.fn(),
  }
  return deps satisfies RunTableLoadDeps
}

describe('runTableLoad', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it('cache hit applies immediately without loading', async () => {
    const cached = entry([view(1)])
    const deps = makeDeps({ cached })
    const p = runTableLoad(1, {}, deps)
    expect(deps.applyFull).toHaveBeenCalledWith(cached)
    expect(await p).toBe('cache-hit')
    expect(deps.setLoading).not.toHaveBeenCalled()
  })

  it('cache hit refreshes in background', async () => {
    const cached = entry([view(1)])
    const same = makeDeps({ cached, load: () => Promise.resolve(entry([view(1)], 'y')) })
    await runTableLoad(1, {}, same)
    expect(same.applyRefresh).toHaveBeenCalledWith(expect.objectContaining({ rows: [{ id: 'y' }] }), false)

    const diff = makeDeps({ cached, load: () => Promise.resolve(entry([view(2)])) })
    await runTableLoad(1, {}, diff)
    expect(diff.applyRefresh).toHaveBeenCalledWith(expect.anything(), true)
  })

  it('cache miss toggles loading', async () => {
    const fresh = entry()
    const deps = makeDeps({ load: () => Promise.resolve(fresh) })
    expect(await runTableLoad(1, {}, deps)).toBe('cache-miss')
    expect(deps.setLoading.mock.calls).toEqual([[true], [false]])
    expect(deps.applyFull).toHaveBeenCalledWith(fresh)
  })

  it('discards result when no longer current', async () => {
    let current = true
    const miss = makeDeps({
      isCurrent: () => current,
      load: async () => {
        current = false
        return entry()
      },
    })
    await runTableLoad(1, {}, miss)
    expect(miss.applyFull).not.toHaveBeenCalled()
    expect(miss.setLoading).not.toHaveBeenCalledWith(false)

    current = true
    const hit = makeDeps({
      cached: entry(),
      isCurrent: () => current,
      load: async () => {
        current = false
        return entry()
      },
    })
    await runTableLoad(1, {}, hit)
    expect(hit.applyRefresh).not.toHaveBeenCalled()
  })

  it('keeps cached data on background failure', async () => {
    const deps = makeDeps({ cached: entry(), load: () => Promise.reject(new TableLoadError('x', 500)) })
    await runTableLoad(1, {}, deps)
    expect(deps.onError).not.toHaveBeenCalled()
    expect(deps.applyFull).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalled()
  })

  it('invalidates and reports on 403/404', async () => {
    const deps = makeDeps({ cached: entry(), load: () => Promise.reject(new TableLoadError('x', 403)) })
    await runTableLoad(7, {}, deps)
    expect(deps.cache.invalidate).toHaveBeenCalledWith(7)
    expect(deps.onError).toHaveBeenCalled()
  })

  it('cache miss failure reports error', async () => {
    const deps = makeDeps({ load: () => Promise.reject(new TableLoadError('x', 500)) })
    await runTableLoad(1, {}, deps)
    expect(deps.onError).toHaveBeenCalled()
    expect(deps.setLoading.mock.calls.at(-1)).toEqual([false])
  })

  it('force skips applyFull', async () => {
    const deps = makeDeps({ cached: entry() })
    await runTableLoad(1, { force: true }, deps)
    expect(deps.applyFull).not.toHaveBeenCalled()
    expect(deps.applyRefresh).toHaveBeenCalled()
    expect(deps.setLoading).not.toHaveBeenCalled()
  })
})
