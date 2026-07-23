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
  lightReaderSettings: DarkReaderSettings
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

  const [lightReaderSettings, setLightReaderSettingsState] = useState<DarkReaderSettings>(() => {
    if (typeof window === 'undefined') {
      return { brightness: 100, contrast: 100, sepia: 0, grayscale: 0 }
    }
    return {
      brightness: Number(localStorage.getItem('lightreader-brightness')) || 100,
      contrast: Number(localStorage.getItem('lightreader-contrast')) || 100,
      sepia: Number(localStorage.getItem('lightreader-sepia')) || 0,
      grayscale: Number(localStorage.getItem('lightreader-grayscale')) || 0,
    }
  })

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

  // Get active settings corresponding to current theme (Light vs Dark)
  const activeSettings = useMemo(() => {
    return theme === 'dark' ? darkReaderSettings : lightReaderSettings
  }, [theme, darkReaderSettings, lightReaderSettings])

  // Apply native CSS theme & DarkReader engine to document
  useEffect(() => {
    if (typeof window === 'undefined') return

    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)

    const hasCustomFilter = activeSettings.brightness !== 100 ||
                            activeSettings.contrast !== 100 ||
                            activeSettings.sepia > 0 ||
                            activeSettings.grayscale > 0

    // Safely load DarkReader on client-side to guarantee 100% visible dark/light transformation
    import('darkreader').then(DarkReader => {
      if (typeof window !== 'undefined' && window.fetch) {
        DarkReader.setFetchMethod(window.fetch)
      }
      if (theme === 'dark' || hasCustomFilter) {
        DarkReader.enable({
          brightness: activeSettings.brightness,
          contrast: activeSettings.contrast,
          sepia: activeSettings.sepia,
          grayscale: activeSettings.grayscale,
        })
      } else {
        DarkReader.disable()
      }
    }).catch(err => console.error('Failed to load DarkReader dynamically', err))

    document.documentElement.style.setProperty('--darkreader-brightness', `${activeSettings.brightness}%`)
    document.documentElement.style.setProperty('--darkreader-contrast', `${activeSettings.contrast}%`)
    document.documentElement.style.setProperty('--darkreader-sepia', `${activeSettings.sepia}%`)
    document.documentElement.style.setProperty('--darkreader-grayscale', `${activeSettings.grayscale}%`)
  }, [theme, activeSettings])

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  const updateDarkReaderSettings = (newSettings: Partial<DarkReaderSettings>) => {
    if (theme === 'dark') {
      const updated = { ...darkReaderSettings, ...newSettings }
      setDarkReaderSettingsState(updated)
      localStorage.setItem('darkreader-brightness', String(updated.brightness))
      localStorage.setItem('darkreader-contrast', String(updated.contrast))
      localStorage.setItem('darkreader-sepia', String(updated.sepia))
      localStorage.setItem('darkreader-grayscale', String(updated.grayscale))
    } else {
      const updated = { ...lightReaderSettings, ...newSettings }
      setLightReaderSettingsState(updated)
      localStorage.setItem('lightreader-brightness', String(updated.brightness))
      localStorage.setItem('lightreader-contrast', String(updated.contrast))
      localStorage.setItem('lightreader-sepia', String(updated.sepia))
      localStorage.setItem('lightreader-grayscale', String(updated.grayscale))
    }
  }

  const state: ThemeState = {
    theme,
    showDarkReaderPanel,
    darkReaderSettings: activeSettings,
    lightReaderSettings,
  }

  const actions: ThemeActions = useMemo(() => ({
    toggleTheme,
    setTheme,
    setShowDarkReaderPanel,
    updateDarkReaderSettings,
  }), [toggleTheme, setTheme, setShowDarkReaderPanel, updateDarkReaderSettings])

  return [state, actions]
}
