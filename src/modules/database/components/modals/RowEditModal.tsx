'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { TableField, TableRow } from '@/modules/database/types'
import RowCommentsPanel, { ActivityLogEntry } from './RowCommentsPanel'
import CollaboratorSelector from './CollaboratorSelector'
import AdvancedFieldInputs from './AdvancedFieldInputs'
import { formatDateValue } from '@/modules/database/utils'

interface RowEditModalProps {
  show: boolean
  row: TableRow | null
  rowIndex?: number
  totalRows?: number
  fields: TableField[]
  onClose: () => void
  onUpdateCell?: (rowId: number, fieldKey: string, value: any) => void
  onNavigatePrevious?: () => void
  onNavigateNext?: () => void
  currentUser?: { username?: string; role?: string } | null
  readOnly?: boolean
}

export default function RowEditModal({
  show,
  row,
  rowIndex,
  totalRows,
  fields,
  onClose,
  onUpdateCell,
  onNavigatePrevious,
  onNavigateNext,
  currentUser,
  readOnly = false
}: RowEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const focusValuesRef = useRef<Record<string, any>>({})

  useEffect(() => {
    if (row) {
      setFormData(row.data || {})
      focusValuesRef.current = {}
    }
  }, [row])

  // Activity Log Key Resolution
  const activityLogField = fields.find(f => f.type === 'activity_log')
  const activityLogKey = activityLogField ? `field_${activityLogField.id}` : 'activity_log'
  const rawLog = formData[activityLogKey] ?? formData.activity_log

  let activityLog: ActivityLogEntry[] = []
  if (Array.isArray(rawLog)) {
    activityLog = rawLog
  } else if (typeof rawLog === 'string' && rawLog.trim()) {
    try {
      activityLog = JSON.parse(rawLog)
    } catch {}
  }

  const handleFocusField = (fieldKey: string) => {
    focusValuesRef.current[fieldKey] = formData[fieldKey] ?? ''
  }

  const commitFieldChangeLog = useCallback((fieldKey: string, finalValue: any, explicitOldValue?: any) => {
    if (readOnly || !row) return

    const fieldId = parseInt(fieldKey.replace('field_', ''))
    const field = fields.find(f => f.id === fieldId)
    if (!field || field.type === 'activity_log') return

    const fieldName = field.name
    const oldValue = explicitOldValue !== undefined ? explicitOldValue : (focusValuesRef.current[fieldKey] ?? '')

    if (JSON.stringify(oldValue) !== JSON.stringify(finalValue)) {
      const nowStr = new Date().toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const formatVal = (v: any) => {
        if (v == null || v === '') return '（空白）'
        if (Array.isArray(v)) {
          const labels = v.map(i => (typeof i === 'object' && i !== null ? (i.value || i.username || i.name || i.id) : String(i)))
          return labels.join(', ') || '（空白）'
        }
        if (typeof v === 'object') return v.value || v.name || JSON.stringify(v)
        return String(v)
      }
      const oldStr = formatVal(oldValue)
      const newStr = formatVal(finalValue)

      const newLogEntry: ActivityLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user: currentUser?.username || '系統',
        time: nowStr,
        content: `將「${fieldName}」由「${oldStr}」變更為「${newStr}」`
      }

      const nextLogs = [...activityLog, newLogEntry]
      focusValuesRef.current[fieldKey] = finalValue
      setFormData(prev => ({ ...prev, [fieldKey]: finalValue, [activityLogKey]: nextLogs }))
      onUpdateCell?.(row.id, activityLogKey, nextLogs)
    }
  }, [readOnly, row, fields, formData, activityLog, activityLogKey, currentUser, onUpdateCell])

  const handleFieldChange = useCallback((fieldKey: string, value: any, isDiscrete: boolean = true) => {
    if (readOnly || !row) return

    const previousValue = formData[fieldKey] ?? ''
    setFormData(prev => ({ ...prev, [fieldKey]: value }))
    onUpdateCell?.(row.id, fieldKey, value)

    if (isDiscrete) {
      commitFieldChangeLog(fieldKey, value, previousValue)
    }
  }, [readOnly, row, onUpdateCell, commitFieldChangeLog, formData])

  const handleChange = (fieldId: number, value: any, isDiscrete: boolean = true) => {
    handleFieldChange(`field_${fieldId}`, value, isDiscrete)
  }

  const handleUpdateActivityLog = (updatedLogs: ActivityLogEntry[]) => {
    if (readOnly || !row) return
    setFormData(prev => ({ ...prev, [activityLogKey]: updatedLogs }))
    onUpdateCell?.(row.id, activityLogKey, updatedLogs)
  }



  if (!show || !row) return null

  return (
    <div
      className="row-edit-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="row-edit-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '900px',
          maxWidth: '92vw',
          height: '680px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              編輯資料列 #{row.id}
            </span>
            {rowIndex !== undefined && totalRows !== undefined && (
              <span style={{ fontSize: '12px', color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '12px' }}>
                {rowIndex + 1} / {totalRows}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onNavigatePrevious && (
              <button 
                onClick={onNavigatePrevious} 
                className="button button--ghost button--small" 
                title="Previous Row"
                style={{ padding: '4px 8px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
              >
                <i className="iconoir-nav-arrow-up"></i>
              </button>
            )}
            {onNavigateNext && (
              <button 
                onClick={onNavigateNext} 
                className="button button--ghost button--small" 
                title="Next Row"
                style={{ padding: '4px 8px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
              >
                <i className="iconoir-nav-arrow-down"></i>
              </button>
            )}
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b', marginLeft: '12px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Two-Column Body Content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* LEFT COLUMN: Fields List (60%) */}
          <div style={{ flex: '0 0 60%', padding: '24px', overflowY: 'auto' }}>
            <ul className="row-modal__field-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {fields.filter(field => field.type !== 'activity_log').map(field => {
                const fieldKey = `field_${field.id}`
                const value = formData[fieldKey] ?? ''

                const isAdvanced = ['collaborator', 'single_select', 'multiple_select', 'link_row'].includes(field.type)

                return (
                  <li key={field.id} className="row-modal__field-item">
                    <div className="control">
                      <label className="control__label control__label--small" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                        <i className={`baserow-icon-${field.type}`} style={{ marginRight: '6px' }}></i>
                        {field.name}
                      </label>
                      <div className="control__elements">
                        {field.type === 'collaborator' ? (
                          <CollaboratorSelector
                            fieldKey={fieldKey}
                            fieldName={field.name}
                            value={value}
                            onChange={(fk, val) => handleFieldChange(fk, val, true)}
                            readOnly={readOnly}
                          />
                        ) : isAdvanced ? (
                          <AdvancedFieldInputs
                            field={field}
                            value={value}
                            onChange={(fk, val) => handleFieldChange(fk, val, true)}
                            readOnly={readOnly}
                          />
                        ) : field.type === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={value === 'true' || value === true || value === '1'}
                            onChange={e => handleChange(field.id, e.target.checked ? 'true' : 'false', true)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        ) : field.type === 'long_text' ? (
                          <textarea
                            className="input input--large"
                            value={value}
                            onFocus={() => handleFocusField(fieldKey)}
                            onChange={e => handleChange(field.id, e.target.value, false)}
                            onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                            rows={3}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
                          />
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            className="input input--large"
                            value={field.type === 'date' ? formatDateValue(value) : (value ?? '')}
                            onFocus={() => handleFocusField(fieldKey)}
                            onChange={e => handleChange(field.id, e.target.value, false)}
                            onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* RIGHT COLUMN: Comments & Activity Log Panel (40%) */}
          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <RowCommentsPanel
              tableId={row.tableId}
              rowId={row.id}
              activityLog={activityLog}
              onUpdateActivityLog={handleUpdateActivityLog}
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
