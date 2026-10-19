import {
  tableDataCache,
  TableLoadError,
  __resetTableDataCacheForTests,
  type TableDataEntry,
} from '../tableDataCache'
import type { TableField, TableRow, TableView } from '../../types'

const rows = [{ id: 1 }] as unknown as TableRow[]
const fields = [{ id: 1 }] as unknown as TableField[]
const views = [{ id: 1 }] as unknown as TableView[]

const makeEntry = (fetchedAt = Date.now()): TableDataEntry => ({ fields, rows, views, fetchedAt })

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

function mockFetchByUrl(overrides: Record<string, unknown> = {}) {
  const fn = jest.fn(async (url: string) => {
    for (const [suffix, res] of Object.entries(overrides)) {
      if (url.endsWith(suffix)) return res
    }
    if (url.endsWith('/fields')) return okResponse(fields)
    if (url.endsWith('/rows')) return okResponse(rows)
    return okResponse(views)
  })
  global.fetch = fn as unknown as typeof fetch
  return fn
}

describe('tableDataCache', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    __resetTableDataCacheForTests()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('load stores entry with fetchedAt', async () => {
    mockFetchByUrl()
    await tableDataCache.load(1)
    const entry = tableDataCache.get(1)
    expect(entry?.rows).toEqual(rows)
    expect(entry?.fetchedAt).toBe(Date.now())
  })

  it('dedupes concurrent loads', async () => {
    const fetchMock = mockFetchByUrl()
    const [a, b] = await Promise.all([tableDataCache.load(1), tableDataCache.load(1)])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(a).toBe(b)
  })

  it('evicts least recently used beyond 8', () => {
    for (let i = 1; i <= 8; i++) tableDataCache.set(i, makeEntry())
    tableDataCache.get(1)
    tableDataCache.set(9, makeEntry())
    expect(tableDataCache.get(2)).toBeUndefined()
    expect(tableDataCache.get(1)).toBeDefined()
  })

  it('does not cache failed loads', async () => {
    mockFetchByUrl({ '/rows': { ok: false, status: 500, json: async () => ({}) } })
    const err = await tableDataCache.load(1).catch((e) => e)
    expect(err).toBeInstanceOf(TableLoadError)
    expect(err.status).toBe(500)
    expect(tableDataCache.get(1)).toBeUndefined()
  })

  it('throws TableLoadError on malformed JSON', async () => {
    mockFetchByUrl({
      '/rows': {
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json')
        },
      },
    })
    const err = await tableDataCache.load(1).catch((e) => e)
    expect(err).toBeInstanceOf(TableLoadError)
    expect(err.status).toBe(200)
    expect(tableDataCache.get(1)).toBeUndefined()
  })

  it('uses status 0 when the network fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    const err = await tableDataCache.load(1).catch((e) => e)
    expect(err).toBeInstanceOf(TableLoadError)
    expect(err.status).toBe(0)
  })

  it('ignores in-flight load after clear', async () => {
    mockFetchByUrl()
    const p = tableDataCache.load(1)
    tableDataCache.clear()
    await p
    expect(tableDataCache.get(1)).toBeUndefined()
  })

  it('invalidate removes entry', () => {
    tableDataCache.set(1, makeEntry())
    tableDataCache.invalidate(1)
    expect(tableDataCache.get(1)).toBeUndefined()
  })

  it('prefetch skips fresh entry', () => {
    const fetchMock = mockFetchByUrl()
    tableDataCache.set(1, makeEntry(Date.now()))
    jest.advanceTimersByTime(29_999)
    tableDataCache.prefetch(1)
    expect(fetchMock).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2)
    tableDataCache.prefetch(1)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('prefetch caps concurrency at 2', () => {
    const fetchMock = jest.fn(() => new Promise(() => {}))
    global.fetch = fetchMock as unknown as typeof fetch
    tableDataCache.prefetch(1)
    tableDataCache.prefetch(2)
    tableDataCache.prefetch(3)
    const urls = fetchMock.mock.calls.map((c) => (c as unknown[])[0] as string)
    expect(urls.some((u) => u.includes('/api/tables/1/'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/tables/2/'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/tables/3/'))).toBe(false)
  })

  it('prefetch swallows errors', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    expect(() => tableDataCache.prefetch(1)).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(tableDataCache.get(1)).toBeUndefined()
  })
})
