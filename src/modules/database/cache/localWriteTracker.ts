/**
 * Database Module - Local Write Tracker
 * Sequence number and in-flight count of local row writes, so a background table refresh can tell
 * whether its server snapshot may be older than what the user just changed on screen
 */

let seq = 0
let pending = 0
let listeners = new Set<() => void>()

/** Marks a local write as started; call the returned function once it settles (success or failure). */
function beginWrite(): () => void {
  seq++
  pending++
  let ended = false
  return () => {
    if (ended) return
    ended = true
    seq++
    pending--
    if (pending === 0) {
      const settled = listeners
      listeners = new Set()
      settled.forEach(cb => cb())
    }
  }
}

/** Current sequence number; changes on every begin and end. */
function snapshot(): number {
  return seq
}

function inFlight(): number {
  return pending
}

/** Calls cb once, the next time the in-flight count drops to zero. Returns an unsubscribe function. */
function onSettled(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const localWriteTracker = { beginWrite, snapshot, inFlight, onSettled }

export function __resetLocalWriteTrackerForTests(): void {
  seq = 0
  pending = 0
  listeners = new Set()
}
