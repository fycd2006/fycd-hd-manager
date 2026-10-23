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
          border: isOpen ? '1px solid var(--border-focus)' : '1px solid var(--border-color)',
          backgroundColor: isOpen ? 'var(--bg-surface)' : 'var(--bg-secondary)',
          cursor: 'pointer',
          fontSize: '13px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minWidth: 0 }}>
          {selected.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)' }}>{placeholder}</span>
          ) : (
            selected.map(v => (
              <span
                key={v}
                style={{ padding: '1px 8px', borderRadius: '999px', backgroundColor: 'var(--brand-green-light)', color: 'var(--brand-green-text)', fontSize: '12px' }}
              >
                {labelOf(v)}
              </span>
            ))
          )}
        </div>
        <ChevronDown size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
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
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
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
                  backgroundColor: isOn ? 'var(--bg-cell-hover)' : 'transparent',
                }}
              >
                <span>{opt.label}</span>
                {isOn && <Check size={14} color="var(--brand-green-text)" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
