import { updateRow } from '../row'

jest.mock('@/lib/pusher-client', () => ({ getSocketId: () => 'sock' }))

describe('rowService.updateRow', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns the cells the server rejected', async () => {
    const rejected = [{ rowId: 1, fieldId: 2, code: 'read_only', reason: '此欄位為唯讀，無法寫入' }]
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ updates: [], rejected }) }) as unknown as typeof fetch

    const res = await updateRow(10, 1, { field_2: 'x' })

    expect(res).toEqual({ ok: true, rejected })
  })
})
