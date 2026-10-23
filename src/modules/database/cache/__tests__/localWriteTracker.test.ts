import { localWriteTracker, __resetLocalWriteTrackerForTests } from '../localWriteTracker'

describe('localWriteTracker', () => {
  beforeEach(() => __resetLocalWriteTrackerForTests())

  it('bumps the sequence on begin and on end', () => {
    const s0 = localWriteTracker.snapshot()
    const end = localWriteTracker.beginWrite()
    const s1 = localWriteTracker.snapshot()
    expect(s1).toBe(s0 + 1)
    end()
    expect(localWriteTracker.snapshot()).toBe(s1 + 1)
  })

  it('counts writes in flight', () => {
    const endA = localWriteTracker.beginWrite()
    const endB = localWriteTracker.beginWrite()
    expect(localWriteTracker.inFlight()).toBe(2)
    endA()
    expect(localWriteTracker.inFlight()).toBe(1)
    endB()
    expect(localWriteTracker.inFlight()).toBe(0)
  })

  it('end is idempotent', () => {
    const end = localWriteTracker.beginWrite()
    end()
    const s = localWriteTracker.snapshot()
    end()
    expect(localWriteTracker.inFlight()).toBe(0)
    expect(localWriteTracker.snapshot()).toBe(s)
  })

  it('onSettled fires when in-flight count reaches zero', () => {
    const cb = jest.fn()
    const endA = localWriteTracker.beginWrite()
    const endB = localWriteTracker.beginWrite()
    localWriteTracker.onSettled(cb)
    endA()
    expect(cb).not.toHaveBeenCalled()
    endB()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('onSettled unsubscribe prevents the callback', () => {
    const cb = jest.fn()
    const end = localWriteTracker.beginWrite()
    const off = localWriteTracker.onSettled(cb)
    off()
    end()
    expect(cb).not.toHaveBeenCalled()
  })
})
