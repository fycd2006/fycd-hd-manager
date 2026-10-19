import { useEffect, useRef } from 'react'
import { getRecentTables } from './recentTables'

const MAX_PREFETCH = 3
const FALLBACK_DELAY_MS = 1500

interface IdlePrefetchParams {
  workspaceId: number | null
  activeTableId: number | null
  validTableIds: number[]
  prefetch: (tableId: number) => void
}

type NetworkInformation = { saveData?: boolean; effectiveType?: string }

function isConstrainedNetwork(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  return !!connection && (connection.saveData === true || connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g')
}

/**
 * 進入工作區後，在瀏覽器閒置時一次一張預載最近開過的表（最多 3 張，排除目前開著的）。
 * 只在 workspaceId 改變時重新排程；其餘參數以 ref 讀最新值。
 */
export function useIdlePrefetch(params: IdlePrefetchParams): void {
  const { workspaceId } = params
  const latestRef = useRef(params)

  useEffect(() => {
    latestRef.current = params
  })

  useEffect(() => {
    if (workspaceId === null || isConstrainedNetwork()) return

    const hasIdle = typeof window.requestIdleCallback === 'function'
    let handle: number | ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let queue: number[] | null = null

    const schedule = () => {
      handle = hasIdle
        ? window.requestIdleCallback(run)
        : setTimeout(run, FALLBACK_DELAY_MS)
    }

    const run = () => {
      if (cancelled) return
      if (queue === null) {
        const { activeTableId, validTableIds } = latestRef.current
        const valid = new Set(validTableIds)
        queue = getRecentTables(workspaceId)
          .filter(id => valid.has(id) && id !== activeTableId)
          .slice(0, MAX_PREFETCH)
      }
      const next = queue.shift()
      if (next === undefined) return
      latestRef.current.prefetch(next)
      if (queue.length > 0) schedule()
    }

    schedule()

    return () => {
      cancelled = true
      if (handle === null) return
      if (hasIdle) window.cancelIdleCallback(handle as number)
      else clearTimeout(handle as ReturnType<typeof setTimeout>)
    }
  }, [workspaceId])
}
