import React, { useMemo, useState } from 'react'
import { GripVertical, X, Plus } from 'lucide-react'
import type { TableField, GroupByRule } from '@/modules/database/types'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { useI18n } from '@/lib/i18n/i18nContext'

interface GroupMenuProps {
  fields: TableField[]
  groupByRules: GroupByRule[]
  setGroupByRules: (rules: GroupByRule[]) => void
  onCollapseAll?: (collapsed: boolean) => void
}

export function GroupMenu({
  fields,
  groupByRules,
  setGroupByRules,
  onCollapseAll,
}: GroupMenuProps) {
  const { t } = useI18n()
  const safeFields = Array.isArray(fields) ? fields : []
  const safeRules = Array.isArray(groupByRules) ? groupByRules : []

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

  const handleAddRule = (targetFieldKey?: string) => {
    const nextField = targetFieldKey || (availableFieldsToAdd.length > 0 ? `field_${availableFieldsToAdd[0].id}` : (safeFields.length > 0 ? `field_${safeFields[0].id}` : ''))
    if (!nextField) return
    const newRule: GroupByRule = {
      fieldKey: nextField,
      order: 'asc',
    }
    setGroupByRules([...safeRules, newRule])
  }

  const handleRemoveRule = (index: number) => {
    const nextRules = safeRules.filter((_, i) => i !== index)
    setGroupByRules(nextRules)
  }

  const handleUpdateRuleField = (index: number, newFieldKey: string) => {
    const nextRules = [...safeRules]
    nextRules[index] = { ...nextRules[index], fieldKey: newFieldKey }
    setGroupByRules(nextRules)
  }

  const handleToggleOrder = (index: number, order: 'asc' | 'desc') => {
    const nextRules = [...safeRules]
    nextRules[index] = { ...nextRules[index], order }
    setGroupByRules(nextRules)
  }

  const getSortLabels = (fieldKey: string) => {
    const fieldId = parseInt(fieldKey.replace('field_', ''), 10)
    const field = safeFields.find(f => f.id === fieldId)
    if (field && (field.type === 'number' || field.type === 'rating' || field.type === 'autonumber')) {
      return { asc: '1 → 9', desc: '9 → 1' }
    }
    if (field && (field.type === 'date' || field.type === 'created_at' || field.type === 'updated_at')) {
      return { asc: '舊 → 新', desc: '新 → 舊' }
    }
    return { asc: 'A → Z', desc: 'Z → A' }
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
    setGroupByRules(updated)
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  if (safeRules.length === 0) {
    return (
      <div style={{ padding: '8px 4px', width: '320px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '16px 8px' }}>
          尚未設定任何分組條件
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <Plus size={14} />
              choose a field to group by
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '480px', maxWidth: '90vw', padding: '4px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Group By Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto', paddingRight: '2px' }}>
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
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                backgroundColor: isOver ? '#f0fdf4' : isDragging ? '#f8fafc' : '#ffffff',
                border: `1px solid ${isOver ? '#86efac' : '#e2e8f0'}`,
                opacity: isDragging ? 0.6 : 1,
                transition: 'all 0.15s ease',
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
                title="拖曳調整層級順序"
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
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="刪除此分組層級"
              >
                <X size={15} />
              </button>

              {/* Level Label */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  width: '68px',
                  flexShrink: 0,
                }}
              >
                {idx === 0 ? 'Group by' : 'Then by'}
              </span>

              {/* Field Select Dropdown */}
              <div style={{ flex: 1, minWidth: '130px' }}>
                <CustomSelect
                  value={rule.fieldKey}
                  options={fieldOptions}
                  onChange={(val) => handleUpdateRuleField(idx, val)}
                  placeholder="選擇欄位"
                />
              </div>

              {/* Order Buttons Toggle (A -> Z vs Z -> A) */}
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
        {/* Add Next Level Grouping */}
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
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Plus size={15} />
          choose a field to group by
        </button>

        {/* Global Collapse All / Expand All */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onCollapseAll?.(true)}
            style={{
              border: 'none',
              background: 'none',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}
          >
            Collapse all
          </button>
          <span style={{ color: '#cbd5e1', fontSize: '12px' }}>|</span>
          <button
            type="button"
            onClick={() => onCollapseAll?.(false)}
            style={{
              border: 'none',
              background: 'none',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}
          >
            Expand all
          </button>
        </div>
      </div>
    </div>
  )
}
