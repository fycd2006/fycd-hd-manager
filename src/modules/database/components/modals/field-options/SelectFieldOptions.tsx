'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { BASEROW_PALETTE, type PaletteColor, getOptionColor } from '@/modules/database/components/views/grid/cells/utils'

export interface SelectOptionItem {
  id: string
  name: string
  color?: string
}

interface SelectFieldOptionsProps {
  optionsList: Array<string | SelectOptionItem>
  setOptionsList: (list: SelectOptionItem[]) => void
  newOptionText: string
  setNewOptionText: (text: string) => void
}

export function SelectFieldOptions({
  optionsList,
  setOptionsList,
  newOptionText,
  setNewOptionText,
}: SelectFieldOptionsProps) {
  const [activeColorPickerIndex, setActiveColorPickerIndex] = useState<number | null>(null)
  const [selectedNewColorIndex, setSelectedNewColorIndex] = useState<number>(0)
  const [newColorPickerOpen, setNewColorPickerOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isUuidPattern = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
    /^[0-9a-f]{24,}$/i.test(s.trim())

  // Normalize options to SelectOptionItem[]
  const cleanOptions: SelectOptionItem[] = optionsList
    .map((opt, idx) => {
      if (typeof opt === 'object' && opt !== null) {
        const id = opt.id || `opt_${idx}`
        const name = opt.name || (opt as any).label || (opt as any).text || (opt as any).value || ''
        const color = opt.color || BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg
        return { id, name, color }
      }
      const str = String(opt || '').trim()
      return {
        id: `opt_${idx}`,
        name: str,
        color: BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg,
      }
    })
    .filter((opt) => opt.name && !isUuidPattern(opt.name))

  // Close color popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveColorPickerIndex(null)
        setNewColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddOption = () => {
    const trimmed = newOptionText.trim()
    if (!trimmed || isUuidPattern(trimmed)) return

    const newColor = BASEROW_PALETTE[selectedNewColorIndex % BASEROW_PALETTE.length].bg
    const newId = 'opt_' + Math.random().toString(36).substr(2, 9)
    const newOption: SelectOptionItem = {
      id: newId,
      name: trimmed,
      color: newColor,
    }

    setOptionsList([...cleanOptions, newOption])
    setNewOptionText('')
    setSelectedNewColorIndex((prev) => (prev + 1) % BASEROW_PALETTE.length)
  }

  return (
    <div
      ref={containerRef}
      style={{
        marginBottom: '16px',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '14px',
        background: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', margin: 0 }}>
          選項清單 (點擊色塊可自訂 12 種顏色)
        </label>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>共 {cleanOptions.length} 個選項</span>
      </div>

      {/* Chips List */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {cleanOptions.map((opt, i) => {
          const colorStyles = getOptionColor(opt.name, cleanOptions)
          return (
            <div
              key={opt.id || i}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                background: colorStyles.bg,
                color: colorStyles.text,
                border: '1px solid rgba(0,0,0,0.06)',
                padding: '3px 8px 3px 6px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 500,
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              {/* Color Dot Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveColorPickerIndex(activeColorPickerIndex === i ? null : i)
                  setNewColorPickerOpen(false)
                }}
                title="更換顏色"
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: colorStyles.text,
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  outline: 'none',
                }}
              />

              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opt.name}
              </span>

              {/* Remove Option */}
              <X
                size={13}
                style={{ cursor: 'pointer', opacity: 0.6, marginLeft: '2px' }}
                onClick={() => {
                  setOptionsList(cleanOptions.filter((_, index) => index !== i))
                  if (activeColorPickerIndex === i) setActiveColorPickerIndex(null)
                }}
              />

              {/* 12-Color Picker Popover */}
              {activeColorPickerIndex === i && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    zIndex: 99999,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    padding: '10px',
                    width: '220px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ gridColumn: 'span 4', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>
                    更換選項色彩 (12 色)
                  </div>
                  {BASEROW_PALETTE.map((pal) => {
                    const isSelected =
                      (opt.color || '').toLowerCase() === pal.bg.toLowerCase() ||
                      (opt.color || '').toLowerCase() === pal.id.toLowerCase()
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => {
                          const updated = [...cleanOptions]
                          updated[i] = { ...updated[i], color: pal.bg }
                          setOptionsList(updated)
                          setActiveColorPickerIndex(null)
                        }}
                        title={pal.name}
                        style={{
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: pal.bg,
                          color: pal.text,
                          border: isSelected ? `2px solid ${pal.text}` : `1px solid ${pal.border}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.1s',
                        }}
                      >
                        {isSelected && <Check size={13} strokeWidth={2.5} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {cleanOptions.length === 0 && (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>尚無選項，請在下方輸入新增。</span>
        )}
      </div>

      {/* Add New Option Input & Pre-selected Color */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
        {/* Pre-select Color Button */}
        <button
          type="button"
          onClick={() => {
            setNewColorPickerOpen(!newColorPickerOpen)
            setActiveColorPickerIndex(null)
          }}
          title="預選顏色"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: BASEROW_PALETTE[selectedNewColorIndex % BASEROW_PALETTE.length].bg,
            border: `1px solid ${BASEROW_PALETTE[selectedNewColorIndex % BASEROW_PALETTE.length].border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: BASEROW_PALETTE[selectedNewColorIndex % BASEROW_PALETTE.length].text,
            }}
          />
        </button>

        {/* 12-Color Popover for New Option */}
        {newColorPickerOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: 0,
              zIndex: 99999,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '10px',
              width: '220px',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ gridColumn: 'span 4', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>
              選擇新選項顏色
            </div>
            {BASEROW_PALETTE.map((pal, idx) => {
              const isSelected = selectedNewColorIndex === idx
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => {
                    setSelectedNewColorIndex(idx)
                    setNewColorPickerOpen(false)
                  }}
                  title={pal.name}
                  style={{
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: pal.bg,
                    color: pal.text,
                    border: isSelected ? `2px solid ${pal.text}` : `1px solid ${pal.border}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && <Check size={13} strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>
        )}

        <input
          type="text"
          value={newOptionText}
          onChange={(e) => setNewOptionText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddOption()
            }
          }}
          placeholder="輸入新選項名稱 & 按 Enter 新增"
          style={{
            flex: 1,
            padding: '7px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none',
            background: '#ffffff',
          }}
        />
        <button
          type="button"
          onClick={handleAddOption}
          style={{
            padding: '7px 14px',
            background: '#18181B',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          新增
        </button>
      </div>
    </div>
  )
}
