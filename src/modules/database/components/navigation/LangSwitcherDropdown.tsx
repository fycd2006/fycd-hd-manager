'use client'

import React from 'react'
import { useI18n, LocaleCode } from '@/lib/i18n/i18nContext'
import { Check, Globe } from 'lucide-react'
import FloatingMenuContainer from '@/components/ui/FloatingMenuContainer'

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

  if (!isOpen || !anchorRect) return null

  const topPos = anchorRect.bottom + 6
  const leftPos = align === 'right' ? anchorRect.right - 200 : anchorRect.left

  return (
    <FloatingMenuContainer show={isOpen} x={leftPos} y={topPos} onClose={onClose} width={200}>
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
    </FloatingMenuContainer>
  )
}
