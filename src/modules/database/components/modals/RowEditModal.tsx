'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronUp, ChevronDown, X, Lock, Star, ExternalLink, Mail, Phone } from 'lucide-react'
import type { TableField, TableRow } from '@/modules/database/types'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import RowCommentsPanel, { ActivityLogEntry } from './RowCommentsPanel'
import CollaboratorSelector from './CollaboratorSelector'
import AdvancedFieldInputs from './AdvancedFieldInputs'
import { formatDateValue } from '@/modules/database/utils'
import { formatNumberValue, renderFormulaCell } from '../views/grid/GridViewCell'

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
    setFormData(prev => ({ ...prev, [fieldKey]: value }))
    onUpdateCell?.(row.id, fieldKey, value)
    if (isDiscrete) {
      commitFieldChangeLog(fieldKey, value)
    }
  }, [readOnly, row, onUpdateCell, commitFieldChangeLog])

  const handleChange = (fieldId: number, value: any, isDiscrete: boolean = true) => {
    handleFieldChange(`field_${fieldId}`, value, isDiscrete)
  }

  const handleUpdateActivityLog = (newLogs: ActivityLogEntry[]) => {
    setFormData(prev => ({ ...prev, [activityLogKey]: newLogs }))
    if (row && onUpdateCell) {
      onUpdateCell(row.id, activityLogKey, JSON.stringify(newLogs))
    }
  }

  const getFieldTypeIcon = (type: string) => {
    const IconFunc = FIELD_TYPE_ICONS[type]
    if (IconFunc) {
      return IconFunc()
    }
    return <span style={{ fontSize: '12px', fontWeight: 600 }}>#</span>
  }


  if (!show || !row) return null

  return (
    <div
      className="modal-overlay animate-in fade-in duration-200"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="row-edit-modal bezel-container animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        style={{
          width: '980px',
          maxWidth: '95vw',
          height: '740px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 30px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid rgba(226, 232, 240, 0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)' }}>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>#</span>
            </div>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              編輯資料列 #{row.id}
            </span>
            {rowIndex !== undefined && totalRows !== undefined && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 12px', borderRadius: '20px', letterSpacing: '0.02em', fontFamily: 'monospace' }}>
                {rowIndex + 1} / {totalRows}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: '2px', border: '1px solid #e2e8f0' }}>
              {onNavigatePrevious && (
                <button 
                  onClick={onNavigatePrevious} 
                  title="上一筆"
                  style={{ padding: '5px 9px', background: '#ffffff', border: 'none', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', transition: 'all 0.15s ease' }}
                  className="active:scale-[0.95]"
                >
                  <ChevronUp size={15} />
                </button>
              )}
              {onNavigateNext && (
                <button 
                  onClick={onNavigateNext} 
                  title="下一筆"
                  style={{ padding: '5px 9px', background: '#ffffff', border: 'none', borderRadius: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)', transition: 'all 0.15s ease' }}
                  className="active:scale-[0.95]"
                >
                  <ChevronDown size={15} />
                </button>
              )}
            </div>
            <button 
              onClick={onClose} 
              style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', marginLeft: '6px', padding: '8px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
              className="hover:bg-slate-200 hover:text-slate-900 active:scale-[0.95]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Two-Column Body Content */}
        <div className="row-edit-modal-body" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: '0 0 60%', padding: '24px 28px', overflowY: 'auto', background: '#fafafa' }}>
            <ul className="row-modal__field-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {fields.filter(field => field.type !== 'activity_log').map(field => {
                const fieldKey = `field_${field.id}`
                const value = formData[fieldKey] ?? ''
                const isAdvanced = ['collaborator', 'single_select', 'multiple_select', 'link_row', 'file', 'attachment'].includes(field.type)

                return (
                  <li key={field.id} className="row-modal__field-item" style={{ background: '#ffffff', border: '1px solid rgba(226, 232, 240, 0.9)', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 2px 10px -3px rgba(15, 23, 42, 0.04)', transition: 'all 0.2s ease' }}>
                    <div className="control">
                      <label className="control__label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
                        <span style={{ color: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', width: '26px', height: '26px', borderRadius: '8px' }}>
                          {getFieldTypeIcon(field.type)}
                        </span>
                        <span>{field.name}</span>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                            <input
                              type="checkbox"
                              checked={value === 'true' || value === true || value === '1' || value === 1}
                              onChange={e => handleChange(field.id, e.target.checked, true)}
                              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#4f46e5' }}
                            />
                            <span style={{ fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                              {(value === 'true' || value === true || value === '1' || value === 1) ? '已勾選 (True)' : '未勾選 (False)'}
                            </span>
                          </div>
                        ) : field.type === 'rating' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px' }}>
                            {[1, 2, 3, 4, 5].map((starNum) => {
                              const ratingVal = Math.min(5, Math.max(0, parseInt(String(value || 0)) || 0))
                              const isFilled = starNum <= ratingVal
                              return (
                                <Star
                                  key={starNum}
                                  size={22}
                                  onClick={() => !readOnly && handleChange(field.id, starNum === ratingVal ? 0 : starNum, true)}
                                  style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.15s ease' }}
                                  fill={isFilled ? '#f59e0b' : '#e2e8f0'}
                                  color={isFilled ? '#d97706' : '#cbd5e1'}
                                />
                              )
                            })}
                            <span style={{ marginLeft: '10px', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                              {value ? `${value} 顆星` : '未評分'}
                            </span>
                          </div>
                        ) : field.type === 'url' ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              className="input soft-input"
                              readOnly={readOnly}
                              value={value ?? ''}
                              onFocus={() => handleFocusField(fieldKey)}
                              onChange={e => handleChange(field.id, e.target.value, false)}
                              onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                              placeholder="https://example.com"
                              style={{ flex: 1, padding: '10px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', outline: 'none' }}
                            />
                            {Boolean(value) && (
                              <a
                                href={String(value).startsWith('http') ? String(value) : `https://${value}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                              >
                                <ExternalLink size={14} />
                                開啟
                              </a>
                            )}
                          </div>
                        ) : field.type === 'email' ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="email"
                              className="input soft-input"
                              readOnly={readOnly}
                              value={value ?? ''}
                              onFocus={() => handleFocusField(fieldKey)}
                              onChange={e => handleChange(field.id, e.target.value, false)}
                              onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                              placeholder="user@example.com"
                              style={{ flex: 1, padding: '10px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', outline: 'none' }}
                            />
                            {Boolean(value) && (
                              <a
                                href={`mailto:${value}`}
                                style={{ padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                              >
                                <Mail size={14} />
                                寫信
                              </a>
                            )}
                          </div>
                        ) : field.type === 'phone_number' ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="tel"
                              className="input soft-input"
                              readOnly={readOnly}
                              value={value ?? ''}
                              onFocus={() => handleFocusField(fieldKey)}
                              onChange={e => handleChange(field.id, e.target.value, false)}
                              onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                              placeholder="0912-345-678"
                              style={{ flex: 1, padding: '10px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', outline: 'none' }}
                            />
                            {Boolean(value) && (
                              <a
                                href={`tel:${value}`}
                                style={{ padding: '9px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                              >
                                <Phone size={14} />
                                撥打
                              </a>
                            )}
                          </div>
                        ) : field.type === 'long_text' ? (
                          <textarea
                            className="input soft-input"
                            value={value}
                            onFocus={() => handleFocusField(fieldKey)}
                            onChange={e => handleChange(field.id, e.target.value, false)}
                            onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                            rows={4}
                            placeholder="請輸入內容..."
                            style={{ width: '100%', padding: '12px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', wordBreak: 'break-all', outline: 'none', transition: 'all 0.15s ease', lineHeight: '1.5' }}
                          />
                        ) : field.type === 'formula' ? (
                          <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minHeight: '42px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {renderFormulaCell(value)}
                            </div>
                            <span style={{ fontSize: '11px', color: '#6366f1', background: '#ffffff', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, flexShrink: 0 }}>公式唯讀</span>
                          </div>
                        ) : ['lookup', 'rollup', 'count', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber', 'uuid'].includes(field.type) ? (
                          <div style={{ padding: '10px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Lock size={14} style={{ color: '#6366f1' }} />
                            <span style={{ wordBreak: 'break-all', fontWeight: 500 }}>{value !== null && value !== undefined ? String(value) : ''}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6366f1', background: '#ffffff', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>唯讀</span>
                          </div>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            step={field.type === 'number' ? 'any' : undefined}
                            className="input soft-input"
                            readOnly={readOnly}
                            value={field.type === 'date' ? formatDateValue(value) : (value ?? '')}
                            onFocus={() => handleFocusField(fieldKey)}
                            onChange={e => {
                              const val = e.target.value
                              if (field.type === 'number') {
                                const trimmed = val.trim()
                                const num = trimmed === '' ? null : Number(trimmed)
                                handleChange(field.id, isNaN(num as any) ? null : num, false)
                              } else {
                                handleChange(field.id, val, false)
                              }
                            }}
                            onBlur={e => {
                              const val = e.target.value
                              if (field.type === 'number') {
                                const trimmed = val.trim()
                                const num = trimmed === '' ? null : Number(trimmed)
                                commitFieldChangeLog(fieldKey, isNaN(num as any) ? null : num)
                              } else {
                                commitFieldChangeLog(fieldKey, val)
                              }
                            }}
                            placeholder="請輸入..."
                            style={{ width: '100%', padding: '10px 14px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '13px', wordBreak: 'break-all', outline: 'none', transition: 'all 0.15s ease' }}
                          />
                        )}
                      </div>
                    </div>
                  </li>

                )
              })}
            </ul>
          </div>

          <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, background: '#ffffff' }}>
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
