import React, { useMemo } from 'react'
import { X, Plus, Star } from 'lucide-react'
import type { TableField, TableRow, FilterRule, FilterItem, FilterGroup, FilterConjunction, DateFilterMode } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'
import {
  getFilterOperators,
  MULTI_VALUE_OPERATORS,
  DATE_OPERATORS,
  NO_VALUE_OPERATORS,
  DATE_COMPARE_MODES,
  DATE_WITHIN_MODES,
  DATE_MODE_LABEL_KEYS,
  DATE_MODES_WITH_AMOUNT,
} from '@/modules/database/constants/fieldTypes'
import { isFilterGroup } from '@/modules/database/utils/filterEvaluation'
import { MultiValueSelect } from './MultiValueSelect'

interface FilterMenuProps {
  fields: TableField[]
  filterRules: FilterItem[]
  setFilterRules: (rules: FilterItem[]) => void
  filterType?: 'AND' | 'OR'
  setFilterType?: (type: 'AND' | 'OR') => void
  rows?: TableRow[]
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  backgroundColor: '#ffffff',
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#475569',
  whiteSpace: 'nowrap',
}

const defaultDateMode = (operator: FilterRule['operator']): DateFilterMode =>
  operator === 'date_within' ? 'past_week' : 'exact'

export function FilterMenu({
  fields,
  filterRules,
  setFilterRules,
  filterType = 'AND',
  setFilterType,
  rows,
}: FilterMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeItems = Array.isArray(filterRules) ? filterRules : []

  const findField = (fieldKey: string) => safeFields.find(f => `field_${f.id}` === fieldKey || String(f.id) === fieldKey)

  const getOperatorOptions = (field: TableField | undefined) =>
    getFilterOperators(field?.type).map(o => ({ value: o.value, label: t(o.labelKey) }))

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

  // Options for multi-value operators: select choices, or the linked rows / users seen in the data
  const getMultiValueOptions = (field: TableField | undefined): { value: string; label: string }[] => {
    if (!field) return []
    if (field.type !== 'link_row' && field.type !== 'collaborator') {
      return getFieldSelectOptions(field).map((o: { value: string; label: string }) => ({ value: o.value, label: o.label }))
    }
    const seen = new Map<string, string>()
    ;(rows || []).forEach(row => {
      const val = row.data?.[`field_${field.id}`]
      if (!Array.isArray(val)) return
      val.forEach((entry: unknown) => {
        if (entry && typeof entry === 'object' && 'id' in entry) {
          const item = entry as { id: unknown; value?: unknown; username?: unknown; name?: unknown }
          const id = String(item.id)
          if (!seen.has(id)) seen.set(id, String(item.value ?? item.username ?? item.name ?? id))
        }
      })
    })
    return Array.from(seen, ([value, label]) => ({ value, label }))
  }

  const newRuleFor = (field: TableField | undefined): FilterRule => {
    const operator = getFilterOperators(field?.type)[0].value
    const rule: FilterRule = { fieldKey: field ? `field_${field.id}` : '', operator, value: '' }
    if (DATE_OPERATORS.includes(operator)) rule.dateMode = defaultDateMode(operator)
    return rule
  }

  const handleAddRule = () => setFilterRules([...safeItems, newRuleFor(safeFields[0])])

  const handleAddGroup = () => {
    const group: FilterGroup = { type: 'group', filterType: 'AND', rules: [newRuleFor(safeFields[0])] }
    setFilterRules([...safeItems, group])
  }

  const changeField = (rule: FilterRule, fieldKey: string): FilterRule => {
    const nextField = findField(fieldKey)
    const ops = getFilterOperators(nextField?.type).map(o => o.value)
    const operator = ops.includes(rule.operator) ? rule.operator : ops[0]
    const next: FilterRule = { fieldKey, operator, value: '' }
    if (DATE_OPERATORS.includes(operator)) next.dateMode = defaultDateMode(operator)
    return next
  }

  const changeOperator = (rule: FilterRule, operator: FilterRule['operator']): FilterRule => {
    const next: FilterRule = { ...rule, operator }
    if (MULTI_VALUE_OPERATORS.includes(operator)) {
      next.values = Array.isArray(rule.values) ? rule.values : []
    } else {
      delete next.values
    }
    if (DATE_OPERATORS.includes(operator)) {
      const modes = operator === 'date_within' ? DATE_WITHIN_MODES : DATE_COMPARE_MODES
      if (!rule.dateMode || !modes.includes(rule.dateMode)) {
        next.dateMode = defaultDateMode(operator)
        delete next.dateAmount
      }
    } else {
      delete next.dateMode
      delete next.dateAmount
    }
    return next
  }

  const conjunctionCell = (idx: number, conjunction: FilterConjunction, setConjunction?: (c: FilterConjunction) => void) => (
    <div style={{ width: '48px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
      {idx === 0 ? (
        <span style={labelStyle}>{t('filter.where') || '當'}</span>
      ) : idx === 1 ? (
        <CustomSelect
          value={conjunction}
          options={[
            { value: 'AND', label: t('filter.and') || '且' },
            { value: 'OR', label: t('filter.or') || '或' },
          ]}
          onChange={(val) => setConjunction?.(val as FilterConjunction)}
        />
      ) : (
        <span style={labelStyle}>
          {conjunction === 'OR' ? (t('filter.or') || '或') : (t('filter.and') || '且')}
        </span>
      )}
    </div>
  )

  const removeButton = (onClick: () => void, title: string) => (
    <button
      type="button"
      onClick={onClick}
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
      title={title}
    >
      <X size={15} />
    </button>
  )

  const renderValueInput = (rule: FilterRule, selectedField: TableField | undefined, onChange: (r: FilterRule) => void) => {
    if (NO_VALUE_OPERATORS.includes(rule.operator)) return null

    let control: React.ReactNode
    if (MULTI_VALUE_OPERATORS.includes(rule.operator)) {
      control = (
        <MultiValueSelect
          value={rule.values || []}
          options={getMultiValueOptions(selectedField)}
          onChange={(values) => onChange({ ...rule, values })}
          placeholder={t('filter.selectValues')}
        />
      )
    } else if (DATE_OPERATORS.includes(rule.operator)) {
      const modes = rule.operator === 'date_within' ? DATE_WITHIN_MODES : DATE_COMPARE_MODES
      const mode = rule.dateMode || defaultDateMode(rule.operator)
      control = (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 120px' }}>
            <CustomSelect
              value={mode}
              options={modes.map(m => ({ value: m, label: t(DATE_MODE_LABEL_KEYS[m]) }))}
              onChange={(val) => {
                const next: FilterRule = { ...rule, dateMode: val as DateFilterMode }
                if (!DATE_MODES_WITH_AMOUNT.includes(val as DateFilterMode)) delete next.dateAmount
                onChange(next)
              }}
            />
          </div>
          {mode === 'exact' && (
            <input
              type="date"
              className="soft-input"
              value={rule.value}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              style={{ ...inputStyle, flex: '1 1 140px' }}
            />
          )}
          {DATE_MODES_WITH_AMOUNT.includes(mode) && (
            <>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className="soft-input"
                value={typeof rule.dateAmount === 'number' ? rule.dateAmount : ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  const next: FilterRule = { ...rule }
                  if (isNaN(n) || n < 0) delete next.dateAmount
                  else next.dateAmount = n
                  onChange(next)
                }}
                style={{ ...inputStyle, width: '80px', flex: '0 0 80px' }}
              />
              <span style={{ fontSize: '13px', color: '#475569' }}>{t('filter.days')}</span>
            </>
          )}
        </div>
      )
    } else {
      const selectOptions = getFieldSelectOptions(selectedField)
      const isSelectType = selectedField && (selectedField.type === 'single_select' || selectedField.type === 'multiple_select') && selectOptions.length > 0
      const isBooleanType = selectedField && selectedField.type === 'boolean'
      const isRatingType = selectedField && selectedField.type === 'rating'
      const setValue = (value: string) => onChange({ ...rule, value })

      control = isSelectType ? (
        <CustomSelect value={rule.value} options={selectOptions} onChange={setValue} placeholder="選擇選項" />
      ) : isBooleanType ? (
        <CustomSelect
          value={rule.value}
          options={[
            { value: 'true', label: '是 (Checked)' },
            { value: 'false', label: '否 (Unchecked)' },
          ]}
          onChange={setValue}
          placeholder="選擇狀態"
        />
      ) : isRatingType ? (
        <CustomSelect
          value={rule.value}
          options={[1, 2, 3, 4, 5].map(n => ({
            value: String(n),
            label: `${n} 星`,
            icon: <Star size={12} fill="#eab308" color="#eab308" />,
          }))}
          onChange={setValue}
          placeholder="評分"
        />
      ) : (
        <input
          type="text"
          inputMode={selectedField?.type === 'number' ? 'decimal' : undefined}
          className="soft-input"
          value={rule.value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('filter.enterValue')}
          style={inputStyle}
        />
      )
    }

    return <div style={{ flex: '1 1 160px', minWidth: '120px', width: '100%' }}>{control}</div>
  }

  const renderRule = (
    rule: FilterRule,
    idx: number,
    conjunction: FilterConjunction,
    setConjunction: ((c: FilterConjunction) => void) | undefined,
    onChange: (r: FilterRule) => void,
    onDelete: () => void,
    key: React.Key
  ) => {
    const selectedField = findField(rule.fieldKey)
    return (
      <div
        key={key}
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
          {removeButton(onDelete, t('common.delete'))}
          {conjunctionCell(idx, conjunction, setConjunction)}

          <div style={{ flex: '1 1 110px', minWidth: '95px' }}>
            <CustomSelect
              value={rule.fieldKey}
              options={fieldOptions}
              onChange={(val) => onChange(changeField(rule, val))}
              placeholder={t('filter.selectField')}
            />
          </div>

          <div style={{ width: '120px', flexShrink: 0 }}>
            <CustomSelect
              value={rule.operator}
              options={getOperatorOptions(selectedField)}
              onChange={(val) => onChange(changeOperator(rule, val as FilterRule['operator']))}
              placeholder={t('common.select')}
            />
          </div>
        </div>

        {renderValueInput(rule, selectedField, onChange)}
      </div>
    )
  }

  const replaceItem = (idx: number, item: FilterItem) => setFilterRules(safeItems.map((it, i) => (i === idx ? item : it)))
  const removeItem = (idx: number) => setFilterRules(safeItems.filter((_, i) => i !== idx))

  const renderGroup = (group: FilterGroup, idx: number) => {
    const groupRules = Array.isArray(group.rules) ? group.rules : []
    const groupConjunction: FilterConjunction = group.filterType === 'OR' ? 'OR' : 'AND'
    const updateGroup = (patch: Partial<FilterGroup>) => replaceItem(idx, { ...group, ...patch })
    return (
      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%' }}>
        <div style={{ paddingTop: '10px' }}>{conjunctionCell(idx, filterType, setFilterType)}</div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            backgroundColor: '#f8fafc',
          }}
        >
          {groupRules.map((rule, ruleIdx) =>
            renderRule(
              rule,
              ruleIdx,
              groupConjunction,
              (c) => updateGroup({ filterType: c }),
              (r) => updateGroup({ rules: groupRules.map((gr, i) => (i === ruleIdx ? r : gr)) }),
              () => updateGroup({ rules: groupRules.filter((_, i) => i !== ruleIdx) }),
              ruleIdx
            )
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => updateGroup({ rules: [...groupRules, newRuleFor(safeFields[0])] })}
              disabled={safeFields.length === 0}
              style={{ border: 'none', background: 'none', color: '#3F6212', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 6px' }}
            >
              <Plus size={13} />
              {t('filter.addRule')}
            </button>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              style={{ border: 'none', background: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', padding: '4px 6px' }}
            >
              {t('filter.deleteGroup')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (safeItems.length === 0) {
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

  const footerButtonStyle: React.CSSProperties = {
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
  }

  return (
    <div style={{ width: '560px', maxWidth: '100%', padding: '2px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Filter Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        {safeItems.map((item, idx) =>
          isFilterGroup(item)
            ? renderGroup(item, idx)
            : renderRule(item, idx, filterType, setFilterType, (r) => replaceItem(idx, r), () => removeItem(idx), idx)
        )}
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
        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { onClick: handleAddRule, label: t('filter.addRule') },
            { onClick: handleAddGroup, label: t('filter.addGroup') },
          ].map(btn => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.onClick}
              disabled={safeFields.length === 0}
              style={footerButtonStyle}
              onMouseEnter={(e) => {
                if (safeFields.length > 0) e.currentTarget.style.backgroundColor = '#f0fdf4'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Plus size={15} />
              {btn.label}
            </button>
          ))}
        </div>

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
      </div>
    </div>
  )
}
