import React from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { TableField, RowColorRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface ColorMenuProps {
  fields: TableField[]
  rowColorRules: RowColorRule[]
  setRowColorRules: (rules: RowColorRule[]) => void
  activeViewId: number | null
  saveViewConfig: (viewId: number, config: any) => void
}

const OPERATOR_OPTIONS = [
  { value: 'contains', label: '包含 (contains)' },
  { value: 'equals', label: '等於 (equals)' },
]

const COLOR_OPTIONS = [
  { value: 'red', label: '🔴 紅色' },
  { value: 'green', label: '🟢 綠色' },
  { value: 'blue', label: '🔵 藍色' },
  { value: 'yellow', label: '🟡 黃色' },
  { value: 'purple', label: '🟣 紫色' },
  { value: 'orange', label: '🟠 橘色' },
]

export function ColorMenu({
  fields,
  rowColorRules,
  setRowColorRules,
  activeViewId,
  saveViewConfig
}: ColorMenuProps) {
  const safeFields = Array.isArray(fields) ? fields : []
  const safeRowColorRules = Array.isArray(rowColorRules) ? rowColorRules : []

  const fieldOptions = safeFields.map((f) => ({
    value: `field_${f.id}`,
    label: f.name,
  }))

  return (
    <div className="colorings">
      {safeRowColorRules.length === 0 ? (
        <div style={{ padding: '8px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
          <div style={{ marginBottom: '12px' }}>在此視圖中的記錄將根據塗色條件著色</div>
          <button
            onClick={() => {
              const newRule: RowColorRule = {
                fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                operator: 'contains',
                value: '',
                color: 'blue'
              }
              const updated = [...safeRowColorRules, newRule]
              setRowColorRules(updated)
              if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#eff6ff',
              color: '#4f46e5',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            新增塗色條件
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {safeRowColorRules.map((rule, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', width: '38px', fontWeight: 600, flexShrink: 0 }}>{idx === 0 ? 'Where' : 'And'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CustomSelect
                  value={rule.fieldKey}
                  options={fieldOptions}
                  onChange={(val) => {
                    const updated = [...safeRowColorRules]
                    updated[idx].fieldKey = val
                    setRowColorRules(updated)
                    if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                  }}
                  placeholder="選擇欄位"
                />
              </div>
              <div style={{ width: '135px', flexShrink: 0 }}>
                <CustomSelect
                  value={rule.operator}
                  options={OPERATOR_OPTIONS}
                  onChange={(val) => {
                    const updated = [...safeRowColorRules]
                    updated[idx].operator = val as RowColorRule['operator']
                    setRowColorRules(updated)
                    if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                  }}
                  placeholder="運算子"
                />
              </div>
              <input 
                type="text" 
                className="soft-input"
                value={rule.value} 
                placeholder="值 (Value)..."
                onChange={(e) => {
                  const updated = [...safeRowColorRules]
                  updated[idx].value = e.target.value
                  setRowColorRules(updated)
                  if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                }}
                style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, outline: 'none' }}
              />
              <div style={{ width: '110px', flexShrink: 0 }}>
                <CustomSelect
                  value={rule.color}
                  options={COLOR_OPTIONS}
                  onChange={(val) => {
                    const updated = [...safeRowColorRules]
                    updated[idx].color = val as RowColorRule['color']
                    setRowColorRules(updated)
                    if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                  }}
                  placeholder="顏色"
                />
              </div>
              <button
                onClick={() => {
                  const updated = safeRowColorRules.filter((_, i) => i !== idx)
                  setRowColorRules(updated)
                  if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                }}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', flexShrink: 0 }}
                title="刪除條件"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div style={{ marginTop: '6px' }}>
            <button
              onClick={() => {
                const newRule: RowColorRule = {
                  fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
                  operator: 'contains',
                  value: '',
                  color: 'blue'
                }
                const updated = [...safeRowColorRules, newRule]
                setRowColorRules(updated)
                if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#eff6ff',
                color: '#4f46e5',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Plus size={14} />
              新增塗色條件
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
