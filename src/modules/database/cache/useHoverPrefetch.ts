import { useCallback, useEffect, useRef, type PointerEventHandler } from 'react'

const HOVER_DELAY_MS = 120

interface PrefetchHandlers {
  onPointerEnter: PointerEventHandler
  onPointerLeave: PointerEventHandler
  onPointerDown: PointerEventHandler
}

/**
 * 滑鼠停留 120ms 才預載（避免掃過就觸發）；觸控按下立即預載。
 * 同時只保留一個計時器，進入新項目會取消前一個。
 */
export function useHoverPrefetch(
  onPrefetch?: (tableId: number) => void
): (tableId: number) => PrefetchHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => clear, [clear])

  return useCallback(
    (tableId: number) => ({
      onPointerEnter: (e) => {
        if (!onPrefetch || e.pointerType !== 'mouse') return
        clear()
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          onPrefetch(tableId)
        }, HOVER_DELAY_MS)
      },
      onPointerLeave: () => clear(),
      onPointerDown: (e) => {
        if (!onPrefetch || e.pointerType === 'mouse') return
        onPrefetch(tableId)
      },
    }),
    [onPrefetch, clear]
  )
}
