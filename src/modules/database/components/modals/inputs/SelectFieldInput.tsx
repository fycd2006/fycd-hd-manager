'use client'

import React, { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'

interface SelectFieldInputProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => Promise<void>
  readOnly?: boolean
}

export const getTagStyle = (idx: number) => {
  const colors = [
    { bg: '#F4F4F5', border: '#E4E4E7', text: '#2d470d' },
    { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
    { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
    { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' },
  ]
  return colors[idx % colors.length]
}

export const cleanChoice = (item: any): string[] => {
  if (item === null || item === undefined || item === '') return []
  if (typeof item === 'object') {
    if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice)
    if (Array.isArray(item.select_options)) return item.select_options.flatMap(cleanChoice)
    if (Array.isArray(item.options)) return item.options.flatMap(cleanChoice)
    const label = item.name ?? item.label ?? item.text ?? item.value ?? item.id
    if (label !== undefined && label !== null) return [String(label)]
    return [String(item)]
  }
  if (typeof item === 'string') {
    const trimmed = item.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"{\\') || trimmed.startsWith('"{')) {
      try {
        let parsed = JSON.parse(trimmed)
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {}
        }
        return cleanChoice(parsed)
      } catch {}
    }
    return [trimmed]
  }
  return [String(item)]
}

export const parseSelectValues = (val: any): string[] => {
  if (val == null || val === '') return []
  if (Array.isArray(val)) return val.flatMap(cleanChoice)
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed.flatMap(cleanChoice)
    } catch {}
    return val.split(',').flatMap(cleanChoice)
  }
  return [String(val)]
}

export function SelectFieldInput({ field, value, onChange, onUpdateField, readOnly }: SelectFieldInputProps) {
  const { t } = useI18n()
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const isMulti = field.type === 'multiple_select'

  const getSelectChoices = (): string[] => {
    let rawItems: any[] = []
    let opts: any = field.options
    if (typeof opts === 'string') {
      try {
        let parsed = JSON.parse(opts)
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {}
        }
        opts = parsed
      } catch {}
    }
    if (Array.isArray(opts)) {
      rawItems = opts
    } else if (opts && typeof opts === 'object') {
      if (Array.isArray(opts.choices)) rawItems = opts.choices
      else if (Array.isArray(opts.select_options)) rawItems = opts.select_options
      else if (Array.isArray(opts.options)) rawItems = opts.options
    }

    if (rawItems.length === 0 && typeof field.options === 'string' && field.options.trim()) {
      rawItems = field.options.split(',')
    }
    const cleaned = rawItems.flatMap(cleanChoice)
    const selected = parseSelectValues(value)
    const combined = Array.from(new Set([...cleaned, ...selected]))
    return combined.filter(Boolean)
  }

  const choices = getSelectChoices()
  const selectedList = parseSelectValues(value)

  const toggleSelectOption = (choice: string, isMulti: boolean) => {
    if (readOnly) return
    if (isMulti) {
      const next = selectedList.includes(choice) ? selectedList.filter(s => s !== choice) : [...selectedList, choice]
      onChange(next)
    } else {
      const next = selectedList.includes(choice) ? [] : [choice]
      onChange(next.length ? next[0] : '')
    }
  }

  const handleAddNewTag = async (isMulti: boolean) => {
    if (!newTagInput.trim() || readOnly) return
    const tagVal = newTagInput.trim()

    toggleSelectOption(tagVal, isMulti)

    if (onUpdateField) {
      let currentChoices = getSelectChoices()
      if (!currentChoices.includes(tagVal)) {
        const updatedChoices = [...currentChoices, tagVal]
        let currentOptions: any = {}
        try {
          if (field.options) {
            currentOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          }
        } catch {}

        const newOptions = typeof field.options === 'string'
          ? JSON.stringify({ ...currentOptions, choices: updatedChoices })
          : { ...currentOptions, choices: updatedChoices }

        await onUpdateField(field.id, { options: newOptions as any })
      }
    }

    setNewTagInput('')
    setIsAddingTag(false)
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px', background: '#ffffff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {choices.map((choice, idx) => {
          const isSelected = selectedList.includes(choice)
          const tagStyle = getTagStyle(idx)

          return (
            <span
              key={choice}
              onClick={() => toggleSelectOption(choice, isMulti)}
              style={{
                cursor: readOnly ? 'default' : 'pointer',
                fontSize: '12px',
                padding: '6px 14px',
                borderRadius: '20px',
                userSelect: 'none',
                background: isSelected ? tagStyle.bg : '#f8fafc',
                border: `1px solid ${isSelected ? tagStyle.border : '#e2e8f0'}`,
                color: isSelected ? tagStyle.text : '#475569',
                fontWeight: isSelected ? 600 : 500,
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {choice}
              {isSelected && <Check size={12} />}
            </span>
          )
        })}

        {!readOnly && (
          isAddingTag ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                autoFocus
                placeholder={t('modals.optionPlaceholder')}
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNewTag(isMulti)
                  } else if (e.key === 'Escape') {
                    setIsAddingTag(false)
                    setNewTagInput('')
                  }
                }}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  border: '1px solid #E4E4E7',
                  borderRadius: '16px',
                  outline: 'none',
                  width: '120px',
                  background: '#ffffff'
                }}
              />
              <button
                type="button"
                onClick={() => handleAddNewTag(isMulti)}
                style={{
                  background: '#18181B',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('common.add')}
              </button>
              <button
                type="button"
                onClick={() => { setIsAddingTag(false); setNewTagInput(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 12px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              className="hover:border-indigo-400 hover:text-[#3F6212] hover:bg-[#F4F4F5]/50"
            >
              <Plus size={12} />
              <span>+ Choose an option</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
