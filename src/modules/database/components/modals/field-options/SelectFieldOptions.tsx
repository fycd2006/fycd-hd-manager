import React from 'react'
import { X } from 'lucide-react'

const getOptionColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return { bg: `hsl(${hue}, 80%, 93%)`, text: `hsl(${hue}, 80%, 30%)` }
}

interface SelectFieldOptionsProps {
  optionsList: string[]
  setOptionsList: (list: string[]) => void
  newOptionText: string
  setNewOptionText: (text: string) => void
}

export function SelectFieldOptions({
  optionsList,
  setOptionsList,
  newOptionText,
  setNewOptionText
}: SelectFieldOptionsProps) {
  return (
    <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>
        Choices / Options
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
        {optionsList.map((opt, i) => {
          const { bg, text } = getOptionColor(opt)
          return (
            <span key={i} style={{ background: bg, color: text, padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {opt}
              <X
                size={12}
                style={{ cursor: 'pointer', opacity: 0.7 }}
                onClick={() => setOptionsList(optionsList.filter((_, index) => index !== i))}
              />
            </span>
          )
        })}
        {optionsList.length === 0 && (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No choices yet. Add options below.</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={newOptionText}
          onChange={(e) => setNewOptionText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (newOptionText.trim()) {
                setOptionsList([...optionsList, newOptionText.trim()])
                setNewOptionText('')
              }
            }
          }}
          placeholder="Enter new choice & press Enter"
          style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
        />
        <button
          type="button"
          onClick={() => {
            if (newOptionText.trim()) {
              setOptionsList([...optionsList, newOptionText.trim()])
              setNewOptionText('')
            }
          }}
          style={{ padding: '6px 12px', background: '#18181B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
        >
          Add
        </button>
      </div>
    </div>
  )
}
