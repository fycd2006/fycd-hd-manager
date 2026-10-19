'use client'

import React, { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface MultiValueSelectProps {
  value: string[]
  options: { value: string; label: string }[]
  onChange: (value: string[]) => void
  placeholder?: string
}

// Lightweight multi-pick dropdown used by "is any of" / "has any of" filter operators
export function MultiValueSelect({ value, options, onChange, placeholder }: MultiValueSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selected = Array.isArray(value) ? value : []
  const labelOf = (v: string) => options.find(o => o.value === v)?.label ?? v

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          minHeight: '32px',
          padding: '4px 10px',
          borderRadius: '10px',
          border: isOpen ? '1px solid #3F6212' : '1px solid #E7E5E4',
          backgroundColor: isOpen ? '#ffffff' : '#FAFAF9',
          cursor: 'pointer',
          fontSize: '13px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minWidth: 0 }}>
          {selected.length === 0 ? (
            <span style={{ color: '#78716C' }}>{placeholder}</span>
          ) : (
            selected.map(v => (
              <span
                key={v}
                style={{ padding: '1px 8px', borderRadius: '999px', backgroundColor: '#ecfccb', color: '#3F6212', fontSize: '12px' }}
              >
                {labelOf(v)}
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} color="#78716C" style={{ flexShrink: 0 }} />
      </div>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #E7E5E4',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            padding: '4px',
          }}
        >
          {options.map(opt => {
            const isOn = selected.includes(opt.value)
            return (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  backgroundColor: isOn ? '#f7fee7' : 'transparent',
                }}
              >
                <span>{opt.label}</span>
                {isOn && <Check size={14} color="#3F6212" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
