import {
  hashQueryParams,
  getMasterViewCacheKey,
  getCachedMasterViewRows,
  setCachedMasterViewRows,
  invalidateMasterViewCache,
  clearAllMemoryCache,
} from '../masterViewCache'

describe('masterViewCache service (Phase 4.5)', () => {
  beforeEach(() => {
    clearAllMemoryCache()
    jest.clearAllMocks()
  })

  it('generates consistent SHA-256 hash for identical query parameters', () => {
    const hash1 = hashQueryParams({
      limit: 50,
      sortField: 'Status',
      sortOrder: 'asc',
      filters: [{ field: 'Status', operator: 'equals', value: 'Done' }],
    })

    const hash2 = hashQueryParams({
      limit: 50,
      sortField: 'Status',
      sortOrder: 'asc',
      filters: [{ field: 'Status', operator: 'equals', value: 'Done' }],
    })

    const hash3 = hashQueryParams({
      limit: 20,
      sortField: 'Status',
      sortOrder: 'asc',
    })

    expect(hash1).toBe(hash2)
    expect(hash1).not.toBe(hash3)
  })

  it('constructs correct cache key format', () => {
    const keyAll = getMasterViewCacheKey(10, null, { limit: 50 })
    expect(keyAll).toMatch(/^master_view:ws_10:all:[a-f0-9]{16}$/)

    const keyView = getMasterViewCacheKey(10, 5, { limit: 50 })
    expect(keyView).toMatch(/^master_view:ws_10:view_5:[a-f0-9]{16}$/)
  })

  it('stores and retrieves master view query results from cache', async () => {
    const cacheKey = 'master_view:ws_1:all:test1234'
    const mockResult = {
      rows: [
        {
          id: 101,
          tableId: 1,
          createdAt: new Date(),
          data: { Title: 'Cached Task' },
        },
      ],
      nextCursor: 'next_cursor_token',
    }

    // Initial cache miss
    const miss = await getCachedMasterViewRows(cacheKey)
    expect(miss).toBeNull()

    // Set cache
    await setCachedMasterViewRows(cacheKey, mockResult, 5)

    // Cache hit
    const hit = await getCachedMasterViewRows(cacheKey)
    expect(hit).not.toBeNull()
    expect(hit?.rows).toHaveLength(1)
    expect(hit?.rows[0].data.Title).toBe('Cached Task')
    expect(hit?.nextCursor).toBe('next_cursor_token')
  })

  it('expires cache entry after TTL', async () => {
    const cacheKey = 'master_view:ws_1:all:expired_test'
    const mockResult = {
      rows: [],
      nextCursor: null,
    }

    // Set with 0.05 second TTL (50ms)
    await setCachedMasterViewRows(cacheKey, mockResult, 0.05)

    // Immediate hit
    const hit = await getCachedMasterViewRows(cacheKey)
    expect(hit).not.toBeNull()

    // Wait 70ms for expiration
    await new Promise((resolve) => setTimeout(resolve, 70))

    const expired = await getCachedMasterViewRows(cacheKey)
    expect(expired).toBeNull()
  })

  it('invalidates cache entries matching workspace prefix', async () => {
    const ws1Key1 = 'master_view:ws_1:all:hash1'
    const ws1Key2 = 'master_view:ws_1:view_5:hash2'
    const ws2Key = 'master_view:ws_2:all:hash3'

    const sample = { rows: [], nextCursor: null }

    await setCachedMasterViewRows(ws1Key1, sample, 10)
    await setCachedMasterViewRows(ws1Key2, sample, 10)
    await setCachedMasterViewRows(ws2Key, sample, 10)

    // Invalidate only workspace 1
    await invalidateMasterViewCache(1)

    expect(await getCachedMasterViewRows(ws1Key1)).toBeNull()
    expect(await getCachedMasterViewRows(ws1Key2)).toBeNull()
    // Workspace 2 remains unaffected
    expect(await getCachedMasterViewRows(ws2Key)).not.toBeNull()
  })

  it('invalidates workspace cache when invalidateMasterViewCacheForTable is called', async () => {
    const ws1Key = 'master_view:ws_42:all:hash_table_inval'
    const sample = { rows: [], nextCursor: null }

    await setCachedMasterViewRows(ws1Key, sample, 10)
    expect(await getCachedMasterViewRows(ws1Key)).not.toBeNull()

    // Mock prisma.databaseTable.findUnique to return workspaceId = 42
    jest.spyOn(require('@/lib/prisma').default.databaseTable, 'findUnique').mockResolvedValue({
      id: 99,
      database: { workspaceId: 42 },
    })

    const { invalidateMasterViewCacheForTable } = require('../masterViewCache')
    await invalidateMasterViewCacheForTable(99)

    expect(await getCachedMasterViewRows(ws1Key)).toBeNull()
  })

  it('handles redis error gracefully during invalidateMasterViewCache without throwing', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { invalidateMasterViewCacheForTable } = require('../masterViewCache')
    
    // Simulate database lookup exception
    jest.spyOn(require('@/lib/prisma').default.databaseTable, 'findUnique').mockRejectedValue(new Error('DB Timeout'))

    await expect(invalidateMasterViewCacheForTable(99)).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

