/**
 * Database Module - Theme Store Hook
 * Manages theme and dark reader settings
 */

import { useState, useEffect, useMemo } from 'react'
import { Theme, DarkReaderSettings } from '../types'

export interface ThemeState {
  theme: Theme
  showDarkReaderPanel: boolean
  darkReaderSettings: DarkReaderSettings
}

export interface ThemeActions {
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setShowDarkReaderPanel: (show: boolean) => void
  updateDarkReaderSettings: (settings: Partial<DarkReaderSettings>) => void
}

export const useThemeStore = (): [ThemeState, ThemeActions] => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('theme') as Theme) || 'light'
  })

  const [showDarkReaderPanel, setShowDarkReaderPanel] = useState(false)

  const [darkReaderSettings, setDarkReaderSettingsState] = useState<DarkReaderSettings>(() => {
    if (typeof window === 'undefined') {
      return { brightness: 100, contrast: 100, sepia: 0, grayscale: 0 }
    }
    return {
      brightness: Number(localStorage.getItem('darkreader-brightness')) || 100,
      contrast: Number(localStorage.getItem('darkreader-contrast')) || 100,
      sepia: Number(localStorage.getItem('darkreader-sepia')) || 0,
      grayscale: Number(localStorage.getItem('darkreader-grayscale')) || 0,
    }
  })

  // Apply native CSS theme & optional DarkReader custom filter to document
  useEffect(() => {
    if (typeof window === 'undefined') return

    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)

    const hasCustomFilter = darkReaderSettings.brightness !== 100 ||
                            darkReaderSettings.contrast !== 100 ||
                            darkReaderSettings.sepia > 0 ||
                            darkReaderSettings.grayscale > 0

    // Safely load DarkReader on client-side only to prevent Next.js SSR "window is not defined" error
    import('darkreader').then(DarkReader => {
      if (typeof window !== 'undefined' && window.fetch) {
        DarkReader.setFetchMethod(window.fetch)
      }
      if (hasCustomFilter) {
        DarkReader.enable({
          brightness: darkReaderSettings.brightness,
          contrast: darkReaderSettings.contrast,
          sepia: darkReaderSettings.sepia,
          grayscale: darkReaderSettings.grayscale,
        })
      } else {
        DarkReader.disable()
      }
    }).catch(err => console.error('Failed to load DarkReader dynamically', err))

    document.documentElement.style.setProperty('--darkreader-brightness', `${darkReaderSettings.brightness}%`)
    document.documentElement.style.setProperty('--darkreader-contrast', `${darkReaderSettings.contrast}%`)
    document.documentElement.style.setProperty('--darkreader-sepia', `${darkReaderSettings.sepia}%`)
    document.documentElement.style.setProperty('--darkreader-grayscale', `${darkReaderSettings.grayscale}%`)
  }, [theme, darkReaderSettings])

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const updateDarkReaderSettings = (newSettings: Partial<DarkReaderSettings>) => {
    const updated = { ...darkReaderSettings, ...newSettings }
    setDarkReaderSettingsState(updated)

    // Save to localStorage
    localStorage.setItem('darkreader-brightness', String(updated.brightness))
    localStorage.setItem('darkreader-contrast', String(updated.contrast))
    localStorage.setItem('darkreader-sepia', String(updated.sepia))
    localStorage.setItem('darkreader-grayscale', String(updated.grayscale))
  }

  const state: ThemeState = {
    theme,
    showDarkReaderPanel,
    darkReaderSettings,
  }

  const actions: ThemeActions = useMemo(() => ({
    toggleTheme,
    setTheme,
    setShowDarkReaderPanel,
    updateDarkReaderSettings,
  }), [toggleTheme, setTheme, setShowDarkReaderPanel, updateDarkReaderSettings])

  return [state, actions]
}
