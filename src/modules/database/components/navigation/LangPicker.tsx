'use client'

import React, { useState, useRef } from 'react'
import { useI18n } from '@/lib/i18n/i18nContext'
import { LangSwitcherDropdown } from './LangSwitcherDropdown'
import { Globe, ChevronDown } from 'lucide-react'

interface LangPickerProps {
  align?: 'left' | 'right'
  variant?: 'toolbar' | 'dashboard' | 'subtle'
  className?: string
}

export const LangPicker: React.FC<LangPickerProps> = ({
  align = 'left',
  variant = 'dashboard',
  className = ''
}) => {
  const { locale, locales } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const currentLocaleObj = locales.find((l) => l.code === locale)
  const visibleLanguageName = currentLocaleObj?.name || '繁體中文'

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect())
    }
    setIsOpen((prev) => !prev)
  }

  // Toolbar Variant (matches ViewToolbar header button system)
  if (variant === 'toolbar') {
    return (
      <div className={`relative inline-block ${className}`}>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className={`header__filter-link ${isOpen ? 'active' : ''}`}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isOpen ? '#F4F4F5' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            padding: '5px 10px',
            fontSize: '13px',
            color: isOpen ? '#3F6212' : '#44403C',
            fontWeight: isOpen ? 600 : 500,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease'
          }}
          title="介面語言 / Language"
        >
          <Globe size={15} color={isOpen ? '#3F6212' : '#78716C'} className="header__filter-icon" />
          <span style={{ color: isOpen ? '#3F6212' : '#44403C' }}>{visibleLanguageName}</span>
          <ChevronDown size={14} color="#78716C" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        <LangSwitcherDropdown
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          align={align}
          anchorRect={anchorRect}
        />
      </div>
    )
  }

  // Dashboard / Default Variant (matches WorkspaceDashboard action buttons)
  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        style={{
          height: '40px',
          padding: '0 14px',
          borderRadius: '8px',
          backgroundColor: isOpen ? '#f4f4f5' : '#ffffff',
          color: isOpen ? '#09090b' : '#27272a',
          border: '1px solid #e4e4e7',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#f4f4f5'
            e.currentTarget.style.borderColor = '#d4d4d8'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#ffffff'
            e.currentTarget.style.borderColor = '#e4e4e7'
          }
        }}
        aria-expanded={isOpen}
        title="切換語言 / Select Language"
      >
        <Globe size={15} color="#52525b" />
        <span>{visibleLanguageName}</span>
        <ChevronDown size={14} color="#71717a" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
      </button>

      <LangSwitcherDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        align={align}
        anchorRect={anchorRect}
      />
    </div>
  )
}
