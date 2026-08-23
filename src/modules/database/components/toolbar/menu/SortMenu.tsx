import React, { useMemo } from 'react'
import { X, Plus } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface SortMenuProps {
  fields: TableField[]
  sortField: string | null
  setSortField: (field: string | null) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (order: 'asc' | 'desc') => void
  activeViewId: number | null
  saveViewConfig: (viewId: number, config: any) => void
}

export function SortMenu({
  fields,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  activeViewId,
  saveViewConfig,
}: SortMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []

  const fieldOptions = useMemo(() => {
    return safeFields.map((f) => ({
      value: `field_${f.id}`,
      label: f.name,
    }))
  }, [safeFields])

  const getSortLabels = (fieldKey: string | null) => {
    if (!fieldKey) return { asc: 'A → Z', desc: 'Z → A' }
    const fieldId = parseInt(fieldKey.replace('field_', ''), 10)
    const field = safeFields.find((f) => f.id === fieldId)
    if (field && (field.type === 'number' || field.type === 'rating' || field.type === 'autonumber')) {
      return { asc: '1 → 9', desc: '9 → 1' }
    }
    if (field && (field.type === 'date' || field.type === 'created_at' || field.type === 'updated_at')) {
      return { asc: '舊 → 新', desc: '新 → 舊' }
    }
    return { asc: 'A → Z', desc: 'Z → A' }
  }

  const handleAddSort = () => {
    if (safeFields.length === 0) return
    const defaultField = `field_${safeFields[0].id}`
    setSortField(defaultField)
    setSortOrder('asc')
    if (activeViewId) {
      saveViewConfig(activeViewId, { sortField: defaultField, sortOrder: 'asc' })
    }
  }

  const handleRemoveSort = () => {
    setSortField(null)
    if (activeViewId) {
      saveViewConfig(activeViewId, { sortField: null, sortOrder: 'asc' })
    }
  }

  const handleFieldChange = (newFieldKey: string) => {
    setSortField(newFieldKey)
    if (activeViewId) {
      saveViewConfig(activeViewId, { sortField: newFieldKey, sortOrder })
    }
  }

  const handleOrderChange = (newOrder: 'asc' | 'desc') => {
    setSortOrder(newOrder)
    if (activeViewId) {
      saveViewConfig(activeViewId, { sortField, sortOrder: newOrder })
    }
  }

  if (!sortField) {
    return (
      <div style={{ padding: '8px 4px', width: '380px', maxWidth: '90vw', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 8px' }}>
          {t('sort.noSort')}
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={handleAddSort}
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
              {t('sort.title')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const sortLabels = getSortLabels(sortField)

  return (
    <div style={{ width: '440px', maxWidth: '90vw', padding: '4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Sort Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Remove Button */}
          <button
            type="button"
            onClick={handleRemoveSort}
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

          {/* Label */}
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              width: '60px',
              flexShrink: 0,
            }}
          >
            {t('sort.title')}
          </span>

          {/* Field Select */}
          <div style={{ flex: 1, minWidth: '130px' }}>
            <CustomSelect
              value={sortField}
              options={fieldOptions}
              onChange={handleFieldChange}
              placeholder={t('filter.selectField')}
            />
          </div>

          {/* Order Toggle Segmented Control */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              gap: '2px',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => handleOrderChange('asc')}
              style={{
                border: 'none',
                backgroundColor: sortOrder === 'asc' ? '#ffffff' : 'transparent',
                color: sortOrder === 'asc' ? '#0f172a' : '#64748b',
                fontWeight: sortOrder === 'asc' ? 700 : 500,
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: sortOrder === 'asc' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {sortLabels.asc}
            </button>
            <button
              type="button"
              onClick={() => handleOrderChange('desc')}
              style={{
                border: 'none',
                backgroundColor: sortOrder === 'desc' ? '#ffffff' : 'transparent',
                color: sortOrder === 'desc' ? '#0f172a' : '#64748b',
                fontWeight: sortOrder === 'desc' ? 700 : 500,
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: sortOrder === 'desc' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {sortLabels.desc}
            </button>
          </div>
        </div>
      </div>

      {/* Footer Bottom Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingTop: '8px',
          borderTop: '1px solid #f1f5f9',
          marginTop: '4px',
        }}
      >
        <button
          type="button"
          onClick={handleRemoveSort}
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
