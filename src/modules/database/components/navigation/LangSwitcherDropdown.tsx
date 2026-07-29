'use client'

import React, { useEffect, useRef } from 'react'
import { useI18n, LocaleCode } from '@/lib/i18n/i18nContext'
import { Check } from 'lucide-react'

interface LangSwitcherDropdownProps {
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
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

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-1.5 ${
        align === 'right' ? 'right-0' : 'left-0'
      } w-44 rounded-md bg-white border border-slate-200 shadow-lg py-1 z-50 animate-in fade-in-50 zoom-in-95 duration-100`}
      style={{ minWidth: '160px' }}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        選擇語言 / Language
      </div>
      {locales.map((loc) => {
        const isSelected = loc.code === locale
        return (
          <button
            key={loc.code}
            onClick={async () => {
              await setLocale(loc.code as LocaleCode)
              onClose()
            }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
              isSelected
                ? 'bg-slate-100 text-slate-900 font-medium'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <span>{loc.name}</span>
            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
          </button>
        )
      })}
    </div>
  )
}
