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

export const LangSwitcherDropdown: React.FC<LangSwitcherDropdownProps> = ({
  isOpen,
  onClose,
  align = 'left',
  anchorRect
}) => {
  const { locale, locales, setLocale, t } = useI18n()
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

  // Calculate top-layer fixed position
  const topPos = anchorRect.bottom + 6
  let leftPos = align === 'right' ? anchorRect.right - 200 : anchorRect.left
  if (typeof window !== 'undefined') {
    leftPos = Math.max(12, Math.min(leftPos, window.innerWidth - 210))
  }

  const menuContent = (
    <div
      style={{
        position: 'fixed',
        top: `${topPos}px`,
        left: `${leftPos}px`,
        zIndex: 99999999,
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        padding: '6px',
        minWidth: '200px',
        boxSizing: 'border-box'
      }}
      ref={dropdownRef}
      role="menu"
      aria-label="Language selection menu"
    >
      <div style={{ padding: '6px 10px 4px 10px', fontSize: '11px', fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Globe size={13} color="#3F6212" />
        <span>{t('common.language')}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
        {locales.map((loc) => {
          const isSelected = loc.code === locale
          return (
            <button
              key={loc.code}
              type="button"
              role="menuitem"
              onClick={async () => {
                await setLocale(loc.code as LocaleCode)
                onClose()
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? '#3F6212' : '#1C1917',
                backgroundColor: isSelected ? '#F4F4F5' : 'transparent',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = '#FAFAF9'
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <span>{loc.name}</span>
              {isSelected && <Check size={16} color="#3F6212" style={{ flexShrink: 0 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )

  return createPortal(menuContent, document.body)
}
