'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'
import { LangSwitcherDropdown } from './LangSwitcherDropdown'
import { Globe, ChevronDown } from 'lucide-react'

interface LangPickerProps {
  align?: 'left' | 'right'
  showIcon?: boolean
  className?: string
  variant?: 'subtle' | 'pill'
}

export const LangPicker: React.FC<LangPickerProps> = ({
  align = 'left',
  showIcon = true,
  className = '',
  variant = 'pill'
}) => {
  const { locale, locales } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  const currentLocaleObj = locales.find((l) => l.code === locale)
  const visibleLanguageName = currentLocaleObj?.name || '繁體中文'
  const flag = locale === 'zh-TW' ? '🇹🇼' : '🇺🇸'

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-blue-50/90 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800'
            : 'bg-white/90 backdrop-blur-md text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900/90 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800/80'
        }`}
        aria-expanded={isOpen}
        title="切換語言 / Select Language"
      >
        <span className="text-sm leading-none flex-shrink-0 select-none group-hover:scale-110 transition-transform">
          {flag}
        </span>
        <span className="tracking-tight font-medium">{visibleLanguageName}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-300 ${isOpen ? 'rotate-180 opacity-100 text-blue-600 dark:text-blue-400' : ''}`} />
      </button>

      <LangSwitcherDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        align={align}
      />
    </div>
  )
}
