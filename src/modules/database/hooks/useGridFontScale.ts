import { useState, useCallback, useSyncExternalStore } from 'react'
import { FontScale, normalizeFontScale } from '../utils/gridDisplay'

export const GRID_FONT_SCALE_KEY = 'fycd.grid.fontScale'

const listeners = new Set<() => void>()

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }
  listeners.add(onStoreChange)
  window.addEventListener('storage', onStoreChange)
  return () => {
    listeners.delete(onStoreChange)
    window.removeEventListener('storage', onStoreChange)
  }
}

function getClientSnapshot(): FontScale {
  if (typeof window === 'undefined') {
    return 'standard'
  }
  try {
    const raw = localStorage.getItem(GRID_FONT_SCALE_KEY)
    return normalizeFontScale(raw)
  } catch {
    return 'standard'
  }
}

function getServerSnapshot(): FontScale {
  return 'standard'
}

export function useGridFontScale(): [FontScale, (v: FontScale) => void] {
  const [localFallback, setLocalFallback] = useState<FontScale | null>(null)
  const storeValue = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)

  const setFontScale = useCallback((v: FontScale) => {
    const normalized = normalizeFontScale(v)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(GRID_FONT_SCALE_KEY, normalized)
      }
      setLocalFallback(null)
      emitChange()
    } catch {
      // Storage failed (e.g. quota exceeded or private browsing)
      // Fallback to local component state so the UI still responds
      setLocalFallback(normalized)
    }
  }, [])

  return [localFallback ?? storeValue, setFontScale]
}
