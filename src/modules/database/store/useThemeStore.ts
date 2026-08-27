/**
 * Database Module - Theme Store Hook
 * Manages theme and dark reader settings with optimized caching & smooth switching
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Theme, DarkReaderSettings } from '../types'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface ThemeState {
  theme: Theme
  themePreference: ThemePreference
  showDarkReaderPanel: boolean
  darkReaderSettings: DarkReaderSettings
  lightReaderSettings: DarkReaderSettings
}

export interface ThemeActions {
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setThemePreference: (pref: ThemePreference) => void
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

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme_preference') as ThemePreference | null
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  // Migrate old 'theme' key
  const legacy = localStorage.getItem('theme') as Theme | null
  if (legacy === 'light' || legacy === 'dark') return legacy
  return 'light'
}

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'system') return getSystemTheme()
  return pref
}

export const useThemeStore = (): [ThemeState, ThemeActions] => {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('light')
  const [theme, setThemeState] = useState<Theme>('light')

  // Sync saved theme preference after mount to prevent SSR hydration mismatch
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pref = loadThemePreference()
    setThemePreferenceState(pref)
    setThemeState(resolveTheme(pref))
  }, [])

  // Listen for OS theme changes when preference is 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || themePreference !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setThemeState(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themePreference])

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
    const newPref: ThemePreference = theme === 'dark' ? 'light' : 'dark'
    setThemePreferenceState(newPref)
    setThemeState(newPref)
    localStorage.setItem('theme_preference', newPref)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemePreferenceState(newTheme)
    setThemeState(newTheme)
    localStorage.setItem('theme_preference', newTheme)
  }, [])

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref)
    setThemeState(resolveTheme(pref))
    localStorage.setItem('theme_preference', pref)
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
    themePreference,
    showDarkReaderPanel,
    darkReaderSettings: activeSettings,
    lightReaderSettings,
  }), [theme, themePreference, showDarkReaderPanel, activeSettings, lightReaderSettings])

  const actions: ThemeActions = useMemo(() => ({
    toggleTheme,
    setTheme,
    setThemePreference,
    setShowDarkReaderPanel,
    updateDarkReaderSettings,
  }), [toggleTheme, setTheme, setThemePreference, setShowDarkReaderPanel, updateDarkReaderSettings])

  return [state, actions]
}

