import { createTable } from '../workspace'

describe('createTable service', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should call API endpoint and return ok: true on HTTP 200', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    } as any)

    const result = await createTable(1, '測試資料表')

    expect(result.ok).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_table', databaseId: 1, name: '測試資料表' }),
    })
  })

  it('should return error message when API returns failure status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue({ error: '資料庫不存在' }),
    } as any)

    const result = await createTable(999, '測試資料表')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('資料庫不存在')
  })

  it('should catch network errors gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

    const result = await createTable(1, '測試資料表')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('建立資料表失敗')
  })
})
