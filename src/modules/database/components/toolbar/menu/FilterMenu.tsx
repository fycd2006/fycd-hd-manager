import React from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { TableField, FilterRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface FilterMenuProps {
  fields: TableField[]
  filterRules: FilterRule[]
  setFilterRules: (rules: FilterRule[]) => void
}

const OPERATOR_OPTIONS = [
  { value: 'contains', label: '包含 (contains)' },
  { value: 'not_contains', label: '不包含 (not contains)' },
  { value: 'equals', label: '等於 (equals)' },
  { value: 'not_equals', label: '不等於 (not equals)' },
  { value: 'empty', label: '為空 (is empty)' },
  { value: 'not_empty', label: '不為空 (is not empty)' },
]

export function FilterMenu({ fields, filterRules, setFilterRules }: FilterMenuProps) {
  const safeFields = Array.isArray(fields) ? fields : []
  const safeFilterRules = Array.isArray(filterRules) ? filterRules : []

  const fieldOptions = safeFields.map((f) => ({
    value: `field_${f.id}`,
    label: f.name,
  }))

  if (safeFilterRules.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
        此視圖尚未設定任何篩選條件
        <div style={{ marginTop: '12px' }}>
          <button 
            onClick={() => {
              const newRule: FilterRule = { fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '', operator: 'contains', value: '' }
              setFilterRules([newRule])
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#F4F4F5',
              color: '#18181B',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background-color 0.15s ease',
            }}
          >
            <Plus size={14} />
            新增篩選條件
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {safeFilterRules.map((rule, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', width: '38px', fontWeight: 600, flexShrink: 0 }}>{idx === 0 ? 'Where' : 'And'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CustomSelect
              value={rule.fieldKey}
              options={fieldOptions}
              onChange={(val) => {
                const newRules = [...safeFilterRules]
                newRules[idx].fieldKey = val
                setFilterRules(newRules)
              }}
              placeholder="選擇欄位"
            />
          </div>
          <div style={{ width: '135px', flexShrink: 0 }}>
            <CustomSelect
              value={rule.operator}
              options={OPERATOR_OPTIONS}
              onChange={(val) => {
                const newRules = [...safeFilterRules]
                newRules[idx].operator = val as FilterRule['operator']
                setFilterRules(newRules)
              }}
              placeholder="運算子"
            />
          </div>
          {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
            <input 
              type="text" 
              className="soft-input"
              value={rule.value} 
              onChange={(e) => {
                const newRules = [...safeFilterRules]
                newRules[idx].value = e.target.value
                setFilterRules(newRules)
              }}
              placeholder="值 (Value)..."
              style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, minWidth: '80px', outline: 'none' }}
            />
          )}
          <button 
            onClick={() => {
              const newRules = safeFilterRules.filter((_, i) => i !== idx)
              setFilterRules(newRules)
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', borderRadius: '6px', flexShrink: 0 }}
            title="刪除條件"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <div style={{ marginTop: '6px' }}>
        <button 
          onClick={() => {
            const newRule: FilterRule = { fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '', operator: 'contains', value: '' }
            setFilterRules([...safeFilterRules, newRule])
          }}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#F4F4F5',
            color: '#18181B',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Plus size={14} />
          新增篩選條件
        </button>
      </div>
    </div>
  )
}
