import React, { useMemo } from 'react'
import { X, Plus, Star } from 'lucide-react'
import type { TableField, FilterRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface FilterMenuProps {
  fields: TableField[]
  filterRules: FilterRule[]
  setFilterRules: (rules: FilterRule[]) => void
  filterType?: 'AND' | 'OR'
  setFilterType?: (type: 'AND' | 'OR') => void
}

export function FilterMenu({
  fields,
  filterRules,
  setFilterRules,
  filterType = 'AND',
  setFilterType,
}: FilterMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeFilterRules = Array.isArray(filterRules) ? filterRules : []

  const getOperatorOptionsForField = (field: TableField | undefined) => {
    const isNum = field && ['number', 'rating', 'autonumber', 'percent', 'currency'].includes(field.type || '')
    if (isNum) {
      return [
        { value: 'equals', label: t('filter.equals') || '= 等於' },
        { value: 'not_equals', label: t('filter.notEquals') || '≠ 不等於' },
        { value: 'higher_than', label: '> 大於' },
        { value: 'higher_than_or_equal', label: '≥ 大於等於' },
        { value: 'lower_than', label: '< 小於' },
        { value: 'lower_than_or_equal', label: '≤ 小於等於' },
        { value: 'empty', label: t('filter.isEmpty') || '為空' },
        { value: 'not_empty', label: t('filter.isNotEmpty') || '不為空' },
      ]
    }
    return [
      { value: 'contains', label: t('filter.contains') },
      { value: 'not_contains', label: t('filter.notContains') },
      { value: 'equals', label: t('filter.equals') },
      { value: 'not_equals', label: t('filter.notEquals') },
      { value: 'empty', label: t('filter.isEmpty') },
      { value: 'not_empty', label: t('filter.isNotEmpty') },
    ]
  }

  const fieldOptions = useMemo(() => safeFields.map((f) => ({
    value: `field_${f.id}`,
    label: f.name,
  })), [safeFields])

  const getFieldSelectOptions = (field: TableField | undefined) => {
    if (!field || !field.options) return []
    try {
      const parsed = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
      const list = parsed.select_options || parsed.options || (Array.isArray(parsed) ? parsed : [])
      return list.map((opt: any) => ({
        value: opt.value || opt.name || String(opt.id || ''),
        label: opt.value || opt.name || String(opt.id || ''),
        icon: opt.color ? (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: opt.color,
              display: 'inline-block',
            }}
          />
        ) : undefined,
      }))
    } catch {
      return []
    }
  }

  const handleAddRule = () => {
    const firstField = safeFields[0]
    const isNum = firstField && ['number', 'rating', 'autonumber', 'percent', 'currency'].includes(firstField.type || '')
    const newRule: FilterRule = {
      fieldKey: firstField ? `field_${firstField.id}` : '',
      operator: isNum ? 'equals' : 'contains',
      value: '',
    }
    setFilterRules([...safeFilterRules, newRule])
  }

  if (safeFilterRules.length === 0) {
    return (
      <div style={{ padding: '8px 4px', width: '380px', maxWidth: '90vw', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 8px' }}>
          {t('filter.noRules')}
          <div style={{ marginTop: '12px' }}>
            <button 
              type="button"
              onClick={handleAddRule}
              disabled={safeFields.length === 0}
              style={{
                padding: '7px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontWeight: 600,
                fontSize: '13px',
                cursor: safeFields.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff' }}
            >
              <Plus size={14} />
              {t('filter.addRule')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '520px', maxWidth: '100%', padding: '2px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Filter Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        {safeFilterRules.map((rule, idx) => {
          const selectedField = safeFields.find(f => `field_${f.id}` === rule.fieldKey || String(f.id) === rule.fieldKey)
          const selectOptions = getFieldSelectOptions(selectedField)
          const isSelectType = selectedField && (selectedField.type === 'single_select' || selectedField.type === 'multiple_select') && selectOptions.length > 0
          const isBooleanType = selectedField && selectedField.type === 'boolean'
          const isRatingType = selectedField && selectedField.type === 'rating'

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                width: '100%',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Top Controls: [Remove] [Where/And/Or] [Field Select] [Operator Select] */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', minWidth: '0', width: '100%' }}>
                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => {
                    const newRules = safeFilterRules.filter((_, i) => i !== idx)
                    setFilterRules(newRules)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#64748b',
                    borderRadius: '4px',
                    flexShrink: 0,
                    transition: 'color 0.15s ease, background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ef4444'
                    e.currentTarget.style.backgroundColor = '#fee2e2'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#64748b'
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  title={t('common.delete')}
                >
                  <X size={15} />
                </button>

                {/* Where / And / Or Operator Selector */}
                <div style={{ width: '48px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                  {idx === 0 ? (
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('filter.where') || '當'}
                    </span>
                  ) : idx === 1 ? (
                    <CustomSelect
                      value={filterType || 'AND'}
                      options={[
                        { value: 'AND', label: t('filter.and') || '且' },
                        { value: 'OR', label: t('filter.or') || '或' },
                      ]}
                      onChange={(val) => setFilterType?.(val as 'AND' | 'OR')}
                    />
                  ) : (
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(filterType || 'AND') === 'OR' ? (t('filter.or') || '或') : (t('filter.and') || '且')}
                    </span>
                  )}
                </div>

                {/* Field Select */}
                <div style={{ flex: '1 1 110px', minWidth: '95px' }}>
                  <CustomSelect
                    value={rule.fieldKey}
                    options={fieldOptions}
                    onChange={(val) => {
                      const newRules = [...safeFilterRules]
                      newRules[idx].fieldKey = val
                      newRules[idx].value = ''
                      const nextField = safeFields.find(f => `field_${f.id}` === val || String(f.id) === val)
                      const nextIsNum = nextField && ['number', 'rating', 'autonumber', 'percent', 'currency'].includes(nextField.type || '')
                      if (nextIsNum && (newRules[idx].operator === 'contains' || newRules[idx].operator === 'not_contains')) {
                        newRules[idx].operator = 'equals'
                      } else if (!nextIsNum && ['higher_than', 'higher_than_or_equal', 'lower_than', 'lower_than_or_equal'].includes(newRules[idx].operator)) {
                        newRules[idx].operator = 'contains'
                      }
                      setFilterRules(newRules)
                    }}
                    placeholder={t('filter.selectField')}
                  />
                </div>

                {/* Operator Select */}
                <div style={{ width: '110px', flexShrink: 0 }}>
                  <CustomSelect
                    value={rule.operator}
                    options={getOperatorOptionsForField(selectedField)}
                    onChange={(val) => {
                      const newRules = [...safeFilterRules]
                      newRules[idx].operator = val as FilterRule['operator']
                      setFilterRules(newRules)
                    }}
                    placeholder={t('common.select')}
                  />
                </div>
              </div>

              {/* Value Input (Wraps cleanly on narrow viewports) */}
              {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
                <div style={{ flex: '1 1 160px', minWidth: '120px', width: '100%' }}>
                  {isSelectType ? (
                    <CustomSelect
                      value={rule.value}
                      options={selectOptions}
                      onChange={(val) => {
                        const newRules = [...safeFilterRules]
                        newRules[idx].value = val
                        setFilterRules(newRules)
                      }}
                      placeholder="選擇選項"
                    />
                  ) : isBooleanType ? (
                    <CustomSelect
                      value={rule.value}
                      options={[
                        { value: 'true', label: '是 (Checked)' },
                        { value: 'false', label: '否 (Unchecked)' },
                      ]}
                      onChange={(val) => {
                        const newRules = [...safeFilterRules]
                        newRules[idx].value = val
                        setFilterRules(newRules)
                      }}
                      placeholder="選擇狀態"
                    />
                  ) : isRatingType ? (
                    <CustomSelect
                      value={rule.value}
                      options={[
                        { value: '1', label: '1 星', icon: <Star size={12} fill="#eab308" color="#eab308" /> },
                        { value: '2', label: '2 星', icon: <Star size={12} fill="#eab308" color="#eab308" /> },
                        { value: '3', label: '3 星', icon: <Star size={12} fill="#eab308" color="#eab308" /> },
                        { value: '4', label: '4 星', icon: <Star size={12} fill="#eab308" color="#eab308" /> },
                        { value: '5', label: '5 星', icon: <Star size={12} fill="#eab308" color="#eab308" /> },
                      ]}
                      onChange={(val) => {
                        const newRules = [...safeFilterRules]
                        newRules[idx].value = val
                        setFilterRules(newRules)
                      }}
                      placeholder="評分"
                    />
                  ) : (
                    <input 
                      type={selectedField?.type === 'date' ? 'date' : 'text'} 
                      inputMode={selectedField?.type === 'number' ? 'decimal' : undefined}
                      className="soft-input"
                      value={rule.value} 
                      onChange={(e) => {
                        const newRules = [...safeFilterRules]
                        newRules[idx].value = e.target.value
                        setFilterRules(newRules)
                      }}
                      placeholder={t('filter.enterValue')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        width: '100%',
                        boxSizing: 'border-box',
                        outline: 'none',
                        backgroundColor: '#ffffff',
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer Bottom Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid #f1f5f9',
          marginTop: '4px',
        }}
      >
        <button
          type="button"
          onClick={handleAddRule}
          disabled={safeFields.length === 0}
          style={{
            border: 'none',
            background: 'none',
            color: safeFields.length === 0 ? '#94a3b8' : '#3F6212',
            fontWeight: 600,
            fontSize: '13px',
            cursor: safeFields.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 6px',
            borderRadius: '6px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (safeFields.length > 0) e.currentTarget.style.backgroundColor = '#f0fdf4'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Plus size={15} />
          {t('filter.addRule')}
        </button>

        {safeFilterRules.length > 0 && (
          <button
            type="button"
            onClick={() => setFilterRules([])}
            style={{
              border: 'none',
              background: 'none',
              color: '#64748b',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#64748b'
            }}
          >
            {t('common.clear')}
          </button>
        )}
      </div>
    </div>
  )
}
