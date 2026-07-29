'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'

export type LocaleCode = 'zh-TW' | 'en'

export interface LocaleOption {
  code: LocaleCode
  name: string
}

export const AVAILABLE_LOCALES: LocaleOption[] = [
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' }
]

const dictionaries: Record<LocaleCode, any> = {
  'zh-TW': zhTW,
  en: en
}

const COOKIE_NAME = 'i18n_locale'
const LOCAL_STORAGE_KEY = 'fycd_i18n_locale'

function detectBrowserLocale(): LocaleCode {
  if (typeof window === 'undefined' || !navigator.language) {
    return 'zh-TW'
  }
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('en')) {
    return 'en'
  }
  return 'zh-TW'
}

function getStoredLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'zh-TW'

  // 1. Try Cookie
  const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  if (cookieMatch && (cookieMatch[1] === 'zh-TW' || cookieMatch[1] === 'en')) {
    return cookieMatch[1] as LocaleCode
  }

  // 2. Try LocalStorage
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (local === 'zh-TW' || local === 'en') {
      return local as LocaleCode
    }
  } catch (e) {
    // Ignore localStorage restrictions
  }

  // 3. Fallback to Browser Detection
  return detectBrowserLocale()
}

interface I18nContextType {
  locale: LocaleCode
  locales: LocaleOption[]
  setLocale: (code: LocaleCode) => Promise<void>
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'zh-TW',
  locales: AVAILABLE_LOCALES,
  setLocale: async () => {},
  t: (key) => key
})

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<LocaleCode>('zh-TW')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const initialLocale = getStoredLocale()
    setLocaleState(initialLocale)
    setMounted(true)
  }, [])

  const setLocale = async (newLocale: LocaleCode) => {
    setLocaleState(newLocale)
    
    // Save to Cookie
    document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000; SameSite=Lax`

    // Save to LocalStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newLocale)
    } catch (e) {
      // Ignore errors
    }
  }

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let current: any = dictionaries[locale] || dictionaries['zh-TW']
    
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k]
      } else {
        // Fallback to English dictionary if key is missing in active locale
        let fallback: any = dictionaries['en']
        for (const fbKey of keys) {
          if (fallback && typeof fallback === 'object' && fbKey in fallback) {
            fallback = fallback[fbKey]
          } else {
            return key
          }
        }
        current = fallback
        break
      }
    }

    if (typeof current !== 'string') {
      return key
    }

    if (params) {
      return Object.entries(params).reduce((str, [pKey, pVal]) => {
        return str.replace(new RegExp(`\\{${pKey}\\}`, 'g'), String(pVal))
      }, current)
    }

    return current
  }

  return (
    <I18nContext.Provider value={{ locale, locales: AVAILABLE_LOCALES, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export const useI18n = () => useContext(I18nContext)
