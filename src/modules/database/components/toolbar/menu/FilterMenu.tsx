import React from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { TableField, FilterRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface FilterMenuProps {
  fields: TableField[]
  filterRules: FilterRule[]
  setFilterRules: (rules: FilterRule[]) => void
}

export function FilterMenu({ fields, filterRules, setFilterRules }: FilterMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeFilterRules = Array.isArray(filterRules) ? filterRules : []

  const operatorOptions = [
    { value: 'contains', label: t('filter.contains') },
    { value: 'not_contains', label: t('filter.notContains') },
    { value: 'equals', label: t('filter.equals') },
    { value: 'not_equals', label: t('filter.notEquals') },
    { value: 'empty', label: t('filter.isEmpty') },
    { value: 'not_empty', label: t('filter.isNotEmpty') },
  ]

  const fieldOptions = safeFields.map((f) => ({
    value: `field_${f.id}`,
    label: f.name,
  }))

  if (safeFilterRules.length === 0) {
    return (
      <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
        {t('filter.noRules')}
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
            {t('filter.addRule')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {safeFilterRules.map((rule, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', width: '38px', fontWeight: 600, flexShrink: 0 }}>
            {idx === 0 ? t('filter.where') : t('filter.and')}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <CustomSelect
              value={rule.fieldKey}
              options={fieldOptions}
              onChange={(val) => {
                const newRules = [...safeFilterRules]
                newRules[idx].fieldKey = val
                setFilterRules(newRules)
              }}
              placeholder={t('filter.selectField')}
            />
          </div>
          <div style={{ width: '135px', flexShrink: 0 }}>
            <CustomSelect
              value={rule.operator}
              options={operatorOptions}
              onChange={(val) => {
                const newRules = [...safeFilterRules]
                newRules[idx].operator = val as FilterRule['operator']
                setFilterRules(newRules)
              }}
              placeholder={t('common.select')}
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
              placeholder={t('filter.enterValue')}
              style={{ padding: '6px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', flex: 1, minWidth: '80px', outline: 'none' }}
            />
          )}
          <button 
            onClick={() => {
              const newRules = safeFilterRules.filter((_, i) => i !== idx)
              setFilterRules(newRules)
            }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8', borderRadius: '6px', flexShrink: 0 }}
            title={t('common.delete')}
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
          {t('filter.addRule')}
        </button>
      </div>
    </div>
  )
}

