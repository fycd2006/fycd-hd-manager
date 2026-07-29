'use client'

import React, { useEffect, useRef } from 'react'
import { useI18n, LocaleCode } from '@/lib/i18n/i18nContext'
import { Check, Globe } from 'lucide-react'

interface LangSwitcherDropdownProps {
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
}

const LOCALE_METADATA: Record<string, { flag: string; nativeName: string; region: string }> = {
  'zh-TW': { flag: '🇹🇼', nativeName: '繁體中文', region: 'Taiwan (ROC)' },
  'en': { flag: '🇺🇸', nativeName: 'English (US)', region: 'United States' }
}

export const LangSwitcherDropdown: React.FC<LangSwitcherDropdownProps> = ({
  isOpen,
  onClose,
  align = 'left'
}) => {
  const { locale, locales, setLocale } = useI18n()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-2 ${
        align === 'right' ? 'right-0' : 'left-0'
      } w-56 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl p-1.5 z-[99999] animate-in fade-in-50 zoom-in-95 duration-150`}
      style={{ minWidth: '220px' }}
      role="menu"
      aria-label="Language selection menu"
    >
      {/* Sleek Header */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-blue-500" />
          <span>語言偏好 / Language</span>
        </div>
        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-full">
          {locales.length} 個語言
        </span>
      </div>

      {/* Language Options List */}
      <div className="space-y-1">
        {locales.map((loc) => {
          const isSelected = loc.code === locale
          const meta = LOCALE_METADATA[loc.code] || { flag: '🌐', nativeName: loc.name, region: '' }
          return (
            <button
              key={loc.code}
              type="button"
              role="menuitem"
              onClick={async () => {
                await setLocale(loc.code as LocaleCode)
                onClose()
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs flex items-center justify-between transition-all duration-150 group cursor-pointer ${
                isSelected
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base select-none group-hover:scale-110 transition-transform">
                  {meta.flag}
                </span>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                    {loc.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                    {meta.region}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
