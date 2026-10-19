import { createServerTiming } from '../serverTiming'

describe('createServerTiming', () => {
  it('formats entries with one decimal', () => {
    const t = createServerTiming()
    t.add('auth', 12.34)
    t.add('total', 5)
    expect(t.header()).toBe('auth;dur=12.3, total;dur=5.0')
  })

  it('accumulates same name', () => {
    const t = createServerTiming()
    t.add('populate', 1)
    t.add('populate', 2)
    expect(t.header()).toContain('populate;dur=3.0')
  })

  it('get returns accumulated ms, 0 when absent', () => {
    const t = createServerTiming()
    t.add('populate', 1)
    t.add('populate', 2)
    expect(t.get('populate')).toBe(3)
    expect(t.get('missing')).toBe(0)
  })

  it('time() records duration and returns value', async () => {
    const t = createServerTiming()
    const v = await t.time('x', async () => 42)
    expect(v).toBe(42)
    expect(t.header()).toMatch(/^x;dur=\d+\.\d$/)
  })

  it('time() records even when fn throws', async () => {
    const t = createServerTiming()
    await expect(t.time('x', async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(t.header()).toContain('x;dur=')
  })
})
