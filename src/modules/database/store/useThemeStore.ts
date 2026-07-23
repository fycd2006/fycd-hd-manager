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

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Apply dark reader settings to document
  useEffect(() => {
    document.documentElement.style.setProperty('--darkreader-brightness', `${darkReaderSettings.brightness}%`)
    document.documentElement.style.setProperty('--darkreader-contrast', `${darkReaderSettings.contrast}%`)
    document.documentElement.style.setProperty('--darkreader-sepia', `${darkReaderSettings.sepia}%`)
    document.documentElement.style.setProperty('--darkreader-grayscale', `${darkReaderSettings.grayscale}%`)
  }, [darkReaderSettings])

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
