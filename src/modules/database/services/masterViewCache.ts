import { createHash } from 'crypto'
import prisma from '@/lib/prisma'
import redisClient, { getCache, setCache, delCache } from '@/lib/redis'
import type { MasterViewRowWithOverrides } from './masterViewOverride'

export interface CachedMasterViewResult {
  rows: MasterViewRowWithOverrides[]
  nextCursor: string | null
  fieldsMap?: Record<string, any>
}

export interface MasterViewCacheQueryParams {
  cursor?: string | null
  limit?: number
  sortField?: string | null
  sortOrder?: 'asc' | 'desc'
  filters?: any[]
  tableIds?: number[] | string | null
}

// In-Memory Fallback Cache when Redis is not configured or in unit testing
interface MemoryCacheEntry {
  data: CachedMasterViewResult
  expiresAt: number
}

const memoryCache = new Map<string, MemoryCacheEntry>()
const DEFAULT_TTL_SECONDS = 10

/**
 * Cleans expired entries from memory cache.
 */
function purgeExpiredMemoryCache() {
  const now = Date.now()
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Computes a deterministic SHA-256 hash of query parameters for cache key generation.
 */
export function hashQueryParams(params: MasterViewCacheQueryParams): string {
  const normalized = {
    cursor: params.cursor || null,
    limit: params.limit || 50,
    sortField: params.sortField || 'createdAt',
    sortOrder: params.sortOrder || 'desc',
    filters: Array.isArray(params.filters) ? params.filters : [],
    tableIds: Array.isArray(params.tableIds)
      ? [...params.tableIds].sort()
      : params.tableIds || null,
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').substring(0, 16)
}

/**
 * Generates a normalized cache key for master view query.
 */
export function getMasterViewCacheKey(
  workspaceId: number,
  masterViewId: number | null | undefined,
  params: MasterViewCacheQueryParams
): string {
  const viewPart = masterViewId ? `view_${masterViewId}` : 'all'
  const paramHash = hashQueryParams(params)
  return `master_view:ws_${workspaceId}:${viewPart}:${paramHash}`
}

/**
 * Reads cached master view query result from Redis or memory cache.
 */
export async function getCachedMasterViewRows(
  cacheKey: string
): Promise<CachedMasterViewResult | null> {
  // 1. Try Redis first if available
  if (redisClient) {
    const cached = await getCache<CachedMasterViewResult>(cacheKey)
    if (cached) return cached
  }

  // 2. Fallback to memory cache
  const memEntry = memoryCache.get(cacheKey)
  if (memEntry) {
    if (memEntry.expiresAt > Date.now()) {
      return memEntry.data
    }
    memoryCache.delete(cacheKey)
  }

  return null
}

/**
 * Writes master view query result to Redis or memory cache with short TTL.
 */
export async function setCachedMasterViewRows(
  cacheKey: string,
  result: CachedMasterViewResult,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<void> {
  // 1. Write to Redis if available
  if (redisClient) {
    await setCache(cacheKey, result, ttlSeconds)
  }

  // 2. Always write to memory cache
  purgeExpiredMemoryCache()
  memoryCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Actively invalidates master view cache entries for a workspace.
 */
export async function invalidateMasterViewCache(
  workspaceId: number,
  masterViewId?: number | null
): Promise<void> {
  const prefix = masterViewId
    ? `master_view:ws_${workspaceId}:view_${masterViewId}:`
    : `master_view:ws_${workspaceId}:`

  // 1. Invalidate Redis keys by pattern if Redis is connected
  if (redisClient) {
    try {
      const keys = await redisClient.keys(`${prefix}*`)
      if (keys.length > 0) {
        await delCache(keys)
      }
    } catch (err) {
      console.warn('[MasterViewCache] Failed to invalidate Redis keys:', err)
    }
  }

  // 2. Invalidate In-Memory cache keys
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}

/**
 * Utility for test suites to completely reset the in-memory cache.
 */
export function clearAllMemoryCache(): void {
  memoryCache.clear()
}

/**
 * Invalidate master view cache for all workspaces referencing a given tableId.
 */
export async function invalidateMasterViewCacheForTable(tableId: number): Promise<void> {
  if (!tableId || isNaN(tableId) || !prisma?.databaseTable?.findUnique) return
  try {
    const table = await prisma.databaseTable.findUnique({
      where: { id: tableId },
      select: { database: { select: { workspaceId: true } } },
    })
    if (table?.database?.workspaceId) {
      await invalidateMasterViewCache(table.database.workspaceId)
    }
  } catch (err) {
    console.warn(`[MasterViewCache] Invalidation for table ${tableId} failed:`, err)
  }
}
