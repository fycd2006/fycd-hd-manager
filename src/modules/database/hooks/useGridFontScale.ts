import { useState, useCallback } from 'react'
import { FontScale, normalizeFontScale } from '../utils/gridDisplay'

export const GRID_FONT_SCALE_KEY = 'fycd.grid.fontScale'

function readSafely(): FontScale {
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

export function useGridFontScale(): [FontScale, (v: FontScale) => void] {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => readSafely())

  const setFontScale = useCallback((v: FontScale) => {
    const normalized = normalizeFontScale(v)
    setFontScaleState(normalized)
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(GRID_FONT_SCALE_KEY, normalized)
      }
    } catch {
      // Ignore storage errors (e.g. private browsing quota exceeded)
    }
  }, [])

  return [fontScale, setFontScale]
}
