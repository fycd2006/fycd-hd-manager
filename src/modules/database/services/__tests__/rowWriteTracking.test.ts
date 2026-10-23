import * as rowService from '../row'
import { localWriteTracker, __resetLocalWriteTrackerForTests } from '../../cache/localWriteTracker'

jest.mock('@/lib/pusher-client', () => ({ getSocketId: () => null }))

describe('row service write tracking', () => {
  beforeEach(() => __resetLocalWriteTrackerForTests())

  const writes: Array<[string, () => Promise<unknown>]> = [
    ['createRow', () => rowService.createRow(1, {})],
    ['updateCell', () => rowService.updateCell(1, 2, 'field_3', 'x')],
    ['updateRow', () => rowService.updateRow(1, 2, {})],
    ['batchUpdateRows', () => rowService.batchUpdateRows(1, [])],
    ['deleteRow', () => rowService.deleteRow(1, 2)],
    ['reorderRows', () => rowService.reorderRows(1, [2])],
    ['batchCreateRows', () => rowService.batchCreateRows(1, [])],
    ['batchDeleteRows', () => rowService.batchDeleteRows(1, [2])],
  ]

  it.each(writes)('%s counts as a local write until the request settles', async (_name, call) => {
    let respond!: (value: unknown) => void
    global.fetch = jest.fn(
      () => new Promise((resolve) => (respond = resolve))
    ) as unknown as typeof fetch

    const before = localWriteTracker.snapshot()
    const p = call()
    expect(localWriteTracker.inFlight()).toBe(1)
    respond({ ok: true, status: 200, json: async () => ({}) })
    await p
    expect(localWriteTracker.inFlight()).toBe(0)
    expect(localWriteTracker.snapshot()).toBe(before + 2)
  })

  it('ends the write when the request fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network')
    }) as unknown as typeof fetch
    await rowService.createRow(1, {})
    expect(localWriteTracker.inFlight()).toBe(0)
  })
})
