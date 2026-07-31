/**
 * Database Module - Theme Store Hook
 * Manages theme and dark reader settings with optimized caching & smooth switching
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

const DEFAULT_SETTINGS: DarkReaderSettings = { brightness: 100, contrast: 100, sepia: 0, grayscale: 0 }

function loadSettings(prefix: string): DarkReaderSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(`${prefix}-settings`)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // fallback
  }
  return {
    brightness: Number(localStorage.getItem(`${prefix}-brightness`)) || 100,
    contrast: Number(localStorage.getItem(`${prefix}-contrast`)) || 100,
    sepia: Number(localStorage.getItem(`${prefix}-sepia`)) || 0,
    grayscale: Number(localStorage.getItem(`${prefix}-grayscale`)) || 0,
  }
}

function saveSettings(prefix: string, settings: DarkReaderSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(`${prefix}-settings`, JSON.stringify(settings))
  } catch {
    // fallback
  }
}

export const useThemeStore = (): [ThemeState, ThemeActions] => {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('theme') as Theme) || 'light'
  })

  const [showDarkReaderPanel, setShowDarkReaderPanel] = useState(false)
  const [lightReaderSettings, setLightReaderSettingsState] = useState<DarkReaderSettings>(() => loadSettings('lightreader'))
  const [darkReaderSettings, setDarkReaderSettingsState] = useState<DarkReaderSettings>(() => loadSettings('darkreader'))

  // Cached DarkReader Module Singleton Reference
  const darkReaderRef = useRef<any>(null)

  // Active settings depending on theme mode
  const activeSettings = useMemo(() => {
    return theme === 'dark' ? darkReaderSettings : lightReaderSettings
  }, [theme, darkReaderSettings, lightReaderSettings])

  // Apply native CSS theme attributes & DarkReader engine
  useEffect(() => {
    if (typeof window === 'undefined') return

    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)

    const applyTheme = (DarkReader: any) => {
      if (typeof window !== 'undefined' && window.fetch) {
        DarkReader.setFetchMethod(window.fetch)
      }
      if (theme === 'dark') {
        DarkReader.enable({
          brightness: activeSettings.brightness,
          contrast: activeSettings.contrast,
          sepia: activeSettings.sepia,
          grayscale: activeSettings.grayscale,
        })
      } else {
        DarkReader.disable()
      }
    }

    if (darkReaderRef.current) {
      applyTheme(darkReaderRef.current)
    } else {
      import('darkreader').then(DarkReader => {
        darkReaderRef.current = DarkReader
        applyTheme(DarkReader)
      }).catch(err => console.error('Failed to load DarkReader dynamically', err))
    }

    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--darkreader-brightness', `${activeSettings.brightness}%`)
    rootStyle.setProperty('--darkreader-contrast', `${activeSettings.contrast}%`)
    rootStyle.setProperty('--darkreader-sepia', `${activeSettings.sepia}%`)
    rootStyle.setProperty('--darkreader-grayscale', `${activeSettings.grayscale}%`)
  }, [theme, activeSettings])

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
  }, [])

  const updateDarkReaderSettings = useCallback((newSettings: Partial<DarkReaderSettings>) => {
    if (theme === 'dark') {
      const updated = { ...darkReaderSettings, ...newSettings }
      setDarkReaderSettingsState(updated)
      saveSettings('darkreader', updated)
    } else {
      const updated = { ...lightReaderSettings, ...newSettings }
      setLightReaderSettingsState(updated)
      saveSettings('lightreader', updated)
    }
  }, [theme, darkReaderSettings, lightReaderSettings])

  const state: ThemeState = useMemo(() => ({
    theme,
    showDarkReaderPanel,
    darkReaderSettings: activeSettings,
    lightReaderSettings,
  }), [theme, showDarkReaderPanel, activeSettings, lightReaderSettings])

  const actions: ThemeActions = useMemo(() => ({
    toggleTheme,
    setTheme,
    setShowDarkReaderPanel,
    updateDarkReaderSettings,
  }), [toggleTheme, setTheme, setShowDarkReaderPanel, updateDarkReaderSettings])

  return [state, actions]
}

