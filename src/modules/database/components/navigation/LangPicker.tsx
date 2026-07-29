'use client'

import React, { useState } from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'
import { LangSwitcherDropdown } from './LangSwitcherDropdown'
import { Globe, ChevronDown } from 'lucide-react'

interface LangPickerProps {
  align?: 'left' | 'right'
  showIcon?: boolean
  className?: string
}

export const LangPicker: React.FC<LangPickerProps> = ({
  align = 'left',
  showIcon = true,
  className = ''
}) => {
  const { locale, locales } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  const currentLocaleObj = locales.find((l) => l.code === locale)
  const visibleLanguageName = currentLocaleObj?.name || '繁體中文'

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all shadow-sm"
        aria-expanded={isOpen}
      >
        {showIcon && <Globe className="w-3.5 h-3.5 text-slate-500" />}
        <span>{visibleLanguageName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <LangSwitcherDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        align={align}
      />
    </div>
  )
}
