import React, { useMemo } from 'react'
import { X, Plus, Star } from 'lucide-react'
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

  const operatorOptions = useMemo(() => [
    { value: 'contains', label: t('filter.contains') },
    { value: 'not_contains', label: t('filter.notContains') },
    { value: 'equals', label: t('filter.equals') },
    { value: 'not_equals', label: t('filter.notEquals') },
    { value: 'empty', label: t('filter.isEmpty') },
    { value: 'not_empty', label: t('filter.isNotEmpty') },
  ], [t])

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
    const newRule: FilterRule = {
      fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
      operator: 'contains',
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
    <div style={{ width: '500px', maxWidth: '90vw', padding: '4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Filter Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
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
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
            >
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
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#64748b',
                  borderRadius: '4px',
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

              {/* Level Label */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  width: '40px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {idx === 0 ? t('filter.where') : t('filter.and')}
              </span>

              {/* Field Select */}
              <div style={{ flex: 1, minWidth: '110px' }}>
                <CustomSelect
                  value={rule.fieldKey}
                  options={fieldOptions}
                  onChange={(val) => {
                    const newRules = [...safeFilterRules]
                    newRules[idx].fieldKey = val
                    newRules[idx].value = ''
                    setFilterRules(newRules)
                  }}
                  placeholder={t('filter.selectField')}
                />
              </div>

              {/* Operator Select */}
              <div style={{ width: '115px', flexShrink: 0 }}>
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

              {/* Value Input (Type Aware) */}
              {rule.operator !== 'empty' && rule.operator !== 'not_empty' && (
                <div style={{ flex: 1, minWidth: '100px' }}>
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
                      type={selectedField?.type === 'number' ? 'number' : selectedField?.type === 'date' ? 'date' : 'text'} 
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
