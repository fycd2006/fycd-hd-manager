import React, { useMemo, useState } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'
import type { TableField, SortRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface SortMenuProps {
  fields: TableField[]
  sortRules: SortRule[]
  setSortRules: (rules: SortRule[]) => void
}

export function SortMenu({
  fields,
  sortRules,
  setSortRules,
}: SortMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeRules = Array.isArray(sortRules) ? sortRules : []

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const fieldOptions = useMemo(() => {
    return safeFields.map((f) => ({
      value: `field_${f.id}`,
      label: f.name,
    }))
  }, [safeFields])

  const availableFieldsToAdd = useMemo(() => {
    const usedFieldKeys = new Set(safeRules.map(r => r.fieldKey))
    return safeFields.filter(f => !usedFieldKeys.has(`field_${f.id}`))
  }, [safeFields, safeRules])

  const getSortLabels = (fieldKey: string) => {
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

  const handleAddRule = (targetFieldKey?: string) => {
    const nextField = targetFieldKey || (availableFieldsToAdd.length > 0 ? `field_${availableFieldsToAdd[0].id}` : (safeFields.length > 0 ? `field_${safeFields[0].id}` : ''))
    if (!nextField) return
    const newRule: SortRule = {
      fieldKey: nextField,
      order: 'asc',
    }
    setSortRules([...safeRules, newRule])
  }

  const handleRemoveRule = (index: number) => {
    const nextRules = safeRules.filter((_, i) => i !== index)
    setSortRules(nextRules)
  }

  const handleUpdateRuleField = (index: number, newFieldKey: string) => {
    const nextRules = [...safeRules]
    nextRules[index] = { ...nextRules[index], fieldKey: newFieldKey }
    setSortRules(nextRules)
  }

  const handleToggleOrder = (index: number, order: 'asc' | 'desc') => {
    const nextRules = [...safeRules]
    nextRules[index] = { ...nextRules[index], order }
    setSortRules(nextRules)
  }

  // Drag and drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIdx(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === index) return
    setDragOverIdx(index)
  }

  const handleDrop = (index: number) => {
    if (draggedIdx === null || draggedIdx === index) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }
    const updated = [...safeRules]
    const [moved] = updated.splice(draggedIdx, 1)
    updated.splice(index, 0, moved)
    setSortRules(updated)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  if (safeRules.length === 0) {
    return (
      <div style={{ padding: '8px 4px', width: '380px', maxWidth: '90vw', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 8px' }}>
          {t('sort.noSort')}
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => handleAddRule()}
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
              {t('sort.addSortRule') || '新增排序條件'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '480px', maxWidth: '100%', padding: '2px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Sort Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
        {safeRules.map((rule, idx) => {
          const sortLabels = getSortLabels(rule.fieldKey)
          const isDragging = draggedIdx === idx
          const isOver = dragOverIdx === idx

          return (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '10px',
                backgroundColor: isOver ? '#f0fdf4' : isDragging ? '#f8fafc' : '#ffffff',
                border: `1px solid ${isOver ? '#86efac' : '#e2e8f0'}`,
                opacity: isDragging ? 0.6 : 1,
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
                width: '100%',
              }}
            >
              {/* Drag Handle */}
              <div
                style={{
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#94a3b8',
                  padding: '2px',
                }}
                title="拖曳調整排序優先順序"
              >
                <GripVertical size={16} />
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => handleRemoveRule(idx)}
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
                  width: '60px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {idx === 0 ? (t('sort.sortBy') || '排序依據') : (t('sort.thenBy') || '次要排序')}
              </span>

              {/* Field Select */}
              <div style={{ flex: 1, minWidth: '130px' }}>
                <CustomSelect
                  value={rule.fieldKey}
                  options={fieldOptions}
                  onChange={(val) => handleUpdateRuleField(idx, val)}
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
                  onClick={() => handleToggleOrder(idx, 'asc')}
                  style={{
                    border: 'none',
                    backgroundColor: rule.order === 'asc' ? '#ffffff' : 'transparent',
                    color: rule.order === 'asc' ? '#0f172a' : '#64748b',
                    fontWeight: rule.order === 'asc' ? 700 : 500,
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: rule.order === 'asc' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sortLabels.asc}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleOrder(idx, 'desc')}
                  style={{
                    border: 'none',
                    backgroundColor: rule.order === 'desc' ? '#ffffff' : 'transparent',
                    color: rule.order === 'desc' ? '#0f172a' : '#64748b',
                    fontWeight: rule.order === 'desc' ? 700 : 500,
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: rule.order === 'desc' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {sortLabels.desc}
                </button>
              </div>
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
          onClick={() => handleAddRule()}
          disabled={availableFieldsToAdd.length === 0}
          style={{
            border: 'none',
            background: 'none',
            color: availableFieldsToAdd.length === 0 ? '#94a3b8' : '#3F6212',
            fontWeight: 600,
            fontSize: '13px',
            cursor: availableFieldsToAdd.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 6px',
            borderRadius: '6px',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (availableFieldsToAdd.length > 0) e.currentTarget.style.backgroundColor = '#f0fdf4'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Plus size={15} />
          {t('sort.addSortRule') || '新增排序條件'}
        </button>

        {safeRules.length > 0 && (
          <button
            type="button"
            onClick={() => setSortRules([])}
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
