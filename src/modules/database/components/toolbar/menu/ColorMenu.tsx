import React, { useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import type { TableField, RowColorRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface ColorMenuProps {
  fields: TableField[]
  rowColorRules: RowColorRule[]
  setRowColorRules: (rules: RowColorRule[]) => void
  activeViewId: number | null
  saveViewConfig: (viewId: number, config: any) => void
}

const COLOR_HEX_MAP: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
}

export function ColorMenu({
  fields,
  rowColorRules,
  setRowColorRules,
  activeViewId,
  saveViewConfig,
}: ColorMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeRowColorRules = Array.isArray(rowColorRules) ? rowColorRules : []

  const operatorOptions = useMemo(() => [
    { value: 'contains', label: t('filter.contains') },
    { value: 'equals', label: t('filter.equals') },
  ], [t])

  const colorOptions = useMemo(() => [
    {
      value: 'red',
      label: t('color.red'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.red, display: 'inline-block' }} />,
    },
    {
      value: 'green',
      label: t('color.green'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.green, display: 'inline-block' }} />,
    },
    {
      value: 'blue',
      label: t('color.blue'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.blue, display: 'inline-block' }} />,
    },
    {
      value: 'yellow',
      label: t('color.yellow'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.yellow, display: 'inline-block' }} />,
    },
    {
      value: 'purple',
      label: t('color.purple'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.purple, display: 'inline-block' }} />,
    },
    {
      value: 'orange',
      label: t('color.orange'),
      icon: <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLOR_HEX_MAP.orange, display: 'inline-block' }} />,
    },
  ], [t])

  const fieldOptions = useMemo(() => safeFields.map((f) => ({
    value: `field_${f.id}`,
    label: f.name,
  })), [safeFields])

  const handleAddRule = () => {
    const newRule: RowColorRule = {
      fieldKey: safeFields.length > 0 ? `field_${safeFields[0].id}` : '',
      operator: 'contains',
      value: '',
      color: 'blue',
    }
    const updated = [...safeRowColorRules, newRule]
    setRowColorRules(updated)
    if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
  }

  if (safeRowColorRules.length === 0) {
    return (
      <div style={{ padding: '8px 4px', width: '380px', maxWidth: '90vw', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 8px' }}>
          {t('toolbar.noColorRules')}
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
              {t('color.addRule')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '530px', maxWidth: '100%', padding: '2px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Color Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        {safeRowColorRules.map((rule, idx) => (
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
            {/* Remove Button */}
            <button
              type="button"
              onClick={() => {
                const updated = safeRowColorRules.filter((_, i) => i !== idx)
                setRowColorRules(updated)
                if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
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
                  const updated = [...safeRowColorRules]
                  updated[idx].fieldKey = val
                  setRowColorRules(updated)
                  if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                }}
                placeholder={t('filter.selectField')}
              />
            </div>

            {/* Operator Select */}
            <div style={{ width: '105px', flexShrink: 0 }}>
              <CustomSelect
                value={rule.operator}
                options={operatorOptions}
                onChange={(val) => {
                  const updated = [...safeRowColorRules]
                  updated[idx].operator = val as RowColorRule['operator']
                  setRowColorRules(updated)
                  if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                }}
                placeholder={t('common.select')}
              />
            </div>

            {/* Value Input */}
            <input 
              type="text" 
              className="soft-input"
              value={rule.value} 
              placeholder={t('toolbar.enterValuePlaceholder')}
              onChange={(e) => {
                const updated = [...safeRowColorRules]
                updated[idx].value = e.target.value
                setRowColorRules(updated)
                if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                flex: 1,
                minWidth: '90px',
                outline: 'none',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            />

            {/* Color Select */}
            <div style={{ width: '105px', flexShrink: 0 }}>
              <CustomSelect
                value={rule.color}
                options={colorOptions}
                onChange={(val) => {
                  const updated = [...safeRowColorRules]
                  updated[idx].color = val as RowColorRule['color']
                  setRowColorRules(updated)
                  if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify(updated) })
                }}
                placeholder={t('color.title')}
              />
            </div>
          </div>
        ))}
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
          {t('color.addRule')}
        </button>

        {safeRowColorRules.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setRowColorRules([])
              if (activeViewId) saveViewConfig(activeViewId, { rowColors: JSON.stringify([]) })
            }}
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
