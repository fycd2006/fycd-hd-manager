'use client'

import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n, LocaleCode } from '@/lib/i18n/i18nContext'
import { Check, Globe } from 'lucide-react'

interface LangSwitcherDropdownProps {
  isOpen: boolean
  onClose: () => void
  align?: 'left' | 'right'
  anchorRect: DOMRect | null
}

const LOCALE_METADATA: Record<string, { flag: string; nativeName: string; region: string }> = {
  'zh-TW': { flag: '🇹🇼', nativeName: '繁體中文', region: 'Taiwan (ROC)' },
  'en': { flag: '🇺🇸', nativeName: 'English (US)', region: 'United States' }
}

export const LangSwitcherDropdown: React.FC<LangSwitcherDropdownProps> = ({
  isOpen,
  onClose,
  align = 'left',
  anchorRect
}) => {
  const { locale, locales, setLocale } = useI18n()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleScrollOrResize = () => {
      onClose()
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscapeKey)
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen, onClose])

  if (!isOpen || !anchorRect) return null

  // Calculate top-layer fixed positioning
  const topPos = anchorRect.bottom + 6
  let leftPos = align === 'right' ? anchorRect.right - 230 : anchorRect.left
  if (typeof window !== 'undefined') {
    leftPos = Math.max(12, Math.min(leftPos, window.innerWidth - 240))
  }

  const menuContent = (
    <div
      style={{
        position: 'fixed',
        top: `${topPos}px`,
        left: `${leftPos}px`,
        zIndex: 99999999,
        width: '230px',
        minWidth: '220px',
        boxSizing: 'border-box'
      }}
      ref={dropdownRef}
      className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-1.5 animate-in fade-in-50 zoom-in-95 duration-150"
      role="menu"
      aria-label="Language selection menu"
    >
      {/* Sleek Header */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1 flex items-center justify-between gap-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
          <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          <span className="whitespace-nowrap">語言偏好 / Language</span>
        </div>
        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
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
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base select-none group-hover:scale-110 transition-transform flex-shrink-0">
                  {meta.flag}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 whitespace-nowrap">
                    {loc.name}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal whitespace-nowrap">
                    {meta.region}
                  </span>
                </div>
              </div>

              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs flex-shrink-0 ml-2">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )

  return createPortal(menuContent, document.body)
}
