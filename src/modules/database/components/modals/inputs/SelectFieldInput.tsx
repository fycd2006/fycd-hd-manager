'use client'

import React, { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'

import { BASEROW_PALETTE, getOptionColor } from '../../views/grid/cells/utils'

interface SelectFieldInputProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => Promise<void>
  readOnly?: boolean
}

export interface SelectOptionItem {
  id: string
  name: string
  color?: string
}

export const getTagStyle = (idx: number, customColor?: string, optName?: string) => {
  if (customColor) {
    const p = BASEROW_PALETTE.find(
      (c) =>
        c.id.toLowerCase() === customColor.toLowerCase() ||
        c.bg.toLowerCase() === customColor.toLowerCase() ||
        c.text.toLowerCase() === customColor.toLowerCase()
    )
    if (p) return { bg: p.bg, border: p.border, text: p.text }
    return { bg: customColor, border: 'rgba(0,0,0,0.1)', text: '#1e293b' }
  }
  if (optName) {
    const col = getOptionColor(optName)
    return { bg: col.bg, border: 'rgba(0,0,0,0.1)', text: col.text }
  }
  const p = BASEROW_PALETTE[idx % BASEROW_PALETTE.length]
  return { bg: p.bg, border: p.border, text: p.text }
}

export const getFieldSelectOptions = (fieldOptions: any): SelectOptionItem[] => {
  let opts = fieldOptions
  if (typeof opts === 'string') {
    try {
      let parsed = JSON.parse(opts)
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed) } catch {}
      }
      opts = parsed
    } catch {}
  }

  let rawList: any[] = []
  if (Array.isArray(opts)) {
    rawList = opts
  } else if (opts && typeof opts === 'object') {
    if (Array.isArray(opts.choices)) rawList = opts.choices
    else if (Array.isArray(opts.select_options)) rawList = opts.select_options
    else if (Array.isArray(opts.options)) rawList = opts.options
    else if (Array.isArray(opts.selectOptions)) rawList = opts.selectOptions
  } else if (typeof opts === 'string' && opts.trim()) {
    rawList = opts.split(',')
  }

  const isUuidPattern = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
    /^[0-9a-f]{24,}$/i.test(s.trim())

  return rawList
    .map((item, idx) => {
      if (typeof item === 'object' && item !== null) {
        const id = String(item.id ?? item.value ?? item.name ?? item.label ?? idx)
        const name = String(item.name ?? item.label ?? item.text ?? item.value ?? item.id ?? '')
        const color = item.color
        return { id, name, color }
      }
      const str = String(item).trim()
      return { id: str, name: str }
    })
    .filter((opt) => opt.name.length > 0 && !isUuidPattern(opt.name))
}

export const parseRawSelectValues = (val: any): string[] => {
  if (val == null || val === '') return []
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === 'object' && item !== null) {
          return String(item.name ?? item.label ?? item.text ?? item.value ?? item.id ?? '')
        }
        return String(item).trim()
      })
      .filter(Boolean)
  }
  if (typeof val === 'object') {
    return [String(val.name ?? val.label ?? val.text ?? val.value ?? val.id ?? '')].filter(Boolean)
  }
  if (typeof val === 'string') {
    const trimmed = val.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"{\\') || trimmed.startsWith('"{')) {
      try {
        let parsed = JSON.parse(trimmed)
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {}
        }
        if (Array.isArray(parsed)) return parseRawSelectValues(parsed)
        if (typeof parsed === 'object' && parsed !== null) return parseRawSelectValues(parsed)
      } catch {}
    }
    return trimmed.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return [String(val)]
}

export function SelectFieldInput({ field, value, onChange, onUpdateField, readOnly }: SelectFieldInputProps) {
  const { t } = useI18n()
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)
  const isMulti = field.type === 'multiple_select'

  const definedOptions = getFieldSelectOptions(field.options)
  const rawSelectedValues = parseRawSelectValues(value)

  // Determine all display options: defined options + any unmatched orphan values (excluding raw UUID strings)
  const orphanValues = rawSelectedValues.filter(
    (rawVal) =>
      !rawVal.startsWith('field_') &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawVal) &&
      !/^[0-9a-f]{24,}$/i.test(rawVal) &&
      !/^opt_[a-z0-9]+$/i.test(rawVal) &&
      !definedOptions.some(
        (opt) =>
          opt.id === rawVal ||
          opt.name === rawVal ||
          opt.name.toLowerCase() === rawVal.toLowerCase() ||
          opt.id.toLowerCase() === rawVal.toLowerCase()
      )
  )

  const allDisplayOptions: SelectOptionItem[] = [
    ...definedOptions,
    // Only include human-readable orphan values
    ...orphanValues.map((v) => ({ id: v, name: v })),
  ]

  const isOptionSelected = (opt: SelectOptionItem): boolean => {
    return rawSelectedValues.some(
      (v) =>
        v === opt.id ||
        v === opt.name ||
        v.toLowerCase() === opt.name.toLowerCase() ||
        v.toLowerCase() === opt.id.toLowerCase()
    )
  }

  const toggleSelectOption = (opt: SelectOptionItem, isMulti: boolean) => {
    if (readOnly) return
    const currentlySelected = isOptionSelected(opt)
    // Always use the readable option name to prevent UUID pollution in row data
    const optVal = opt.name || opt.id

    if (isMulti) {
      if (currentlySelected) {
        // Remove matching ids/names
        const next = rawSelectedValues.filter(
          (v) =>
            v !== opt.id &&
            v !== opt.name &&
            v.toLowerCase() !== opt.name.toLowerCase() &&
            v.toLowerCase() !== opt.id.toLowerCase()
        )
        onChange(next)
      } else {
        // Add readable option name
        const next = [...rawSelectedValues, optVal]
        onChange(next)
      }
    } else {
      if (currentlySelected) {
        onChange('')
      } else {
        onChange(optVal)
      }
    }
  }

  const handleAddNewTag = async (isMulti: boolean) => {
    if (!newTagInput.trim() || readOnly) return
    const tagVal = newTagInput.trim()
    const newId = 'opt_' + Math.random().toString(36).substring(2, 10)
    const newOpt: SelectOptionItem = { id: newId, name: tagVal }

    if (isMulti) {
      onChange([...rawSelectedValues, newId])
    } else {
      onChange(newId)
    }

    if (onUpdateField) {
      let currentOptionsObj: any = {}
      try {
        if (field.options) {
          currentOptionsObj = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        }
      } catch {}

      const updatedChoices = [...definedOptions, newOpt]
      const newOptions =
        typeof field.options === 'string'
          ? JSON.stringify({ ...currentOptionsObj, choices: updatedChoices })
          : { ...currentOptionsObj, choices: updatedChoices }

      await onUpdateField(field.id, { options: newOptions as any })
    }

    setNewTagInput('')
    setIsAddingTag(false)
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px', background: '#ffffff' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {allDisplayOptions.map((opt, idx) => {
          const isSelected = isOptionSelected(opt)
          const tagStyle = getTagStyle(idx, opt.color, opt.name)

          return (
            <span
              key={`${opt.id}-${idx}`}
              onClick={() => toggleSelectOption(opt, isMulti)}
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
              {opt.name}
              {isSelected && <Check size={12} />}
            </span>
          )
        })}

        {!readOnly &&
          (isAddingTag ? (
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
                  background: '#ffffff',
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
                  cursor: 'pointer',
                }}
              >
                {t('common.add')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTag(false)
                  setNewTagInput('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
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
                transition: 'all 0.15s ease',
              }}
              className="hover:border-indigo-400 hover:text-[#3F6212] hover:bg-[#F4F4F5]/50"
            >
              <Plus size={12} />
              <span>新增選項</span>
            </button>
          ))}
      </div>
    </div>
  )
}

