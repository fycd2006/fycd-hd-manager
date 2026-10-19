/**
 * Database Module - Table Data Cache
 * Client-side LRU cache of fields/rows/views per table, with request dedupe and throttled prefetch
 */

import type { TableField, TableRow, TableView } from '../types'

export interface TableDataEntry {
  fields: TableField[]
  rows: TableRow[]
  views: TableView[]
  fetchedAt: number
}

export class TableLoadError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'TableLoadError'
    this.status = status
  }
}

const MAX_ENTRIES = 8
const PREFETCH_FRESH_MS = 30_000
const MAX_PREFETCH_CONCURRENCY = 2

let entries = new Map<number, TableDataEntry>()
let inflight = new Map<number, Promise<TableDataEntry>>()
let generation = 0
let prefetching = 0

async function fetchJsonStrict<T>(url: string, headers?: Record<string, string>): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store', headers })
  } catch {
    throw new TableLoadError('Network error', 0)
  }
  if (!res.ok) throw new TableLoadError(`Request failed: ${res.status}`, res.status)
  return (await res.json()) as T
}

function get(tableId: number): TableDataEntry | undefined {
  const entry = entries.get(tableId)
  if (!entry) return undefined
  entries.delete(tableId)
  entries.set(tableId, entry)
  return entry
}

function set(tableId: number, entry: TableDataEntry): void {
  entries.delete(tableId)
  entries.set(tableId, entry)
  while (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest === undefined) break
    entries.delete(oldest)
  }
}

function invalidate(tableId: number): void {
  entries.delete(tableId)
}

function clear(): void {
  generation++
  entries.clear()
  inflight.clear()
}

function load(tableId: number): Promise<TableDataEntry> {
  const existing = inflight.get(tableId)
  if (existing) return existing

  const startedGeneration = generation
  const promise = (async () => {
    const [fields, rows, views] = await Promise.all([
      fetchJsonStrict<TableField[]>(`/api/tables/${tableId}/fields`),
      fetchJsonStrict<TableRow[]>(`/api/tables/${tableId}/rows`, { 'Cache-Control': 'no-cache' }),
      fetchJsonStrict<TableView[]>(`/api/tables/${tableId}/views`),
    ])
    const entry: TableDataEntry = { fields, rows, views, fetchedAt: Date.now() }
    if (startedGeneration === generation) set(tableId, entry)
    return entry
  })().finally(() => {
    if (inflight.get(tableId) === promise) inflight.delete(tableId)
  })

  inflight.set(tableId, promise)
  return promise
}

function prefetch(tableId: number): void {
  const entry = entries.get(tableId)
  if (entry && Date.now() - entry.fetchedAt < PREFETCH_FRESH_MS) return
  if (prefetching >= MAX_PREFETCH_CONCURRENCY) return
  prefetching++
  load(tableId)
    .catch(() => {})
    .finally(() => {
      prefetching--
    })
}

export const tableDataCache = { get, set, invalidate, clear, load, prefetch }

export function __resetTableDataCacheForTests(): void {
  entries = new Map()
  inflight = new Map()
  generation = 0
  prefetching = 0
}
