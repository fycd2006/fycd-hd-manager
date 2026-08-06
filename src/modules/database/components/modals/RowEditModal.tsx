'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsRight, ChevronsLeft, ChevronUp, ChevronDown, X, Info, Plus } from 'lucide-react'
import type { TableField, TableRow } from '@/modules/database/types'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import RowCommentsPanel, { ActivityLogEntry } from './RowCommentsPanel'
import CollaboratorSelector from './CollaboratorSelector'
import AdvancedFieldInputs from './AdvancedFieldInputs'
import { formatDateValue } from '@/modules/database/utils'
import { renderFormulaCell } from '../views/grid/GridViewCell'

interface RowEditModalProps {
  show: boolean
  row: TableRow | null
  rowIndex?: number
  totalRows?: number
  fields: TableField[]
  onClose: () => void
  onUpdateCell?: (rowId: number, fieldKey: string, value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => Promise<void>
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
  onUpdateField,
  onNavigatePrevious,
  onNavigateNext,
  currentUser,
  readOnly = false
}: RowEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const focusValuesRef = useRef<Record<string, any>>({})
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [mobileTab, setMobileTab] = useState<'form' | 'comments'>('form')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (row) {
      setFormData(row.data || {})
      if ((row as any).activityLog) {
        setActivityLog((row as any).activityLog)
      } else if (row.data && (row.data as any).activityLog) {
        setActivityLog((row.data as any).activityLog)
      } else {
        setActivityLog([])
      }
    }
  }, [row])

  const primaryField = fields.find(f => f.order === 0) || fields[0]
  const primaryFieldKey = primaryField ? `field_${primaryField.id}` : null
  const rowTitle = primaryFieldKey && formData[primaryFieldKey] != null && String(formData[primaryFieldKey]).trim()
    ? String(formData[primaryFieldKey])
    : (row ? `Row #${row.id}` : 'Record Detail')

  const handleChange = (fieldId: number, value: any, immediateSave = false) => {
    const fieldKey = `field_${fieldId}`
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }))

    if (immediateSave && onUpdateCell && row) {
      onUpdateCell(row.id, fieldKey, value)
    }
  }

  const handleFocusField = (fieldKey: string) => {
    focusValuesRef.current[fieldKey] = formData[fieldKey]
  }

  const commitFieldChangeLog = (fieldKey: string, newValue: any) => {
    const oldValue = focusValuesRef.current[fieldKey]
    if (oldValue !== newValue && onUpdateCell && row) {
      onUpdateCell(row.id, fieldKey, newValue)
    }
  }

  const renderFieldIcon = (type: string) => {
    const IconFunc = FIELD_TYPE_ICONS[type]
    if (IconFunc) {
      return IconFunc()
    }
    return <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Τ</span>
  }

  const overlayRef = useRef<HTMLDivElement>(null)
  const mousedownOnBackdropRef = useRef<boolean>(false)

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mousedownOnBackdropRef.current = (e.target === overlayRef.current)
  }

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && mousedownOnBackdropRef.current) {
      onClose()
    }
    mousedownOnBackdropRef.current = false
  }

  if (!show || !row) return null

  const modalContent = (
    <div
      ref={overlayRef}
      className="modal-overlay animate-in fade-in duration-150"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        className="row-edit-modal row-edit-modal-card animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
        style={{
          width: isSidebarCollapsed ? '720px' : '1040px',
          maxWidth: '96vw',
          height: '800px',
          maxHeight: '92vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div 
          className="row-edit-modal-left" 
          style={{ 
            flex: isSidebarCollapsed ? '1 1 100%' : '1 1 62%', 
            display: (isMobile && mobileTab !== 'form') ? 'none' : 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            minWidth: 0, 
            background: '#ffffff', 
            transition: 'flex 0.25s ease' 
          }}
        >
          <div className="row-edit-modal-header" style={{ padding: isMobile ? '16px 18px 12px' : '24px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rowTitle}
              </h2>
              {rowIndex !== undefined && totalRows !== undefined && (
                <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '12px', fontWeight: 500, flexShrink: 0 }}>
                  {rowIndex + 1} / {totalRows}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                <button
                  type="button"
                  onClick={onNavigatePrevious}
                  disabled={!onNavigatePrevious || rowIndex === 0}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: (onNavigatePrevious && rowIndex !== 0) ? '#475569' : '#cbd5e1',
                    cursor: (onNavigatePrevious && rowIndex !== 0) ? 'pointer' : 'default',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="上一列"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={onNavigateNext}
                  disabled={!onNavigateNext || (totalRows !== undefined && rowIndex === totalRows - 1)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: (onNavigateNext && totalRows !== undefined && rowIndex !== totalRows - 1) ? '#475569' : '#cbd5e1',
                    cursor: (onNavigateNext && totalRows !== undefined && rowIndex !== totalRows - 1) ? 'pointer' : 'default',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="下一列"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              {!isMobile && (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(prev => !prev)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '6px',
                    transition: 'background 0.15s ease',
                  }}
                  className="hover:bg-slate-100"
                  title={isSidebarCollapsed ? '展開右側留言欄 (<<)' : '收闔右側留言欄 (>>)'}
                >
                  {isSidebarCollapsed ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                className="hover:bg-slate-100"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {isMobile && (
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 12px' }}>
              <button
                type="button"
                onClick={() => setMobileTab('form')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontWeight: mobileTab === 'form' ? 700 : 500,
                  color: mobileTab === 'form' ? '#EA580C' : '#64748b',
                  borderBottom: mobileTab === 'form' ? '2.5px solid #EA580C' : '2.5px solid transparent',
                  background: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                📝 詳細內容
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('comments')}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  fontWeight: mobileTab === 'comments' ? 700 : 500,
                  color: mobileTab === 'comments' ? '#EA580C' : '#64748b',
                  borderBottom: mobileTab === 'comments' ? '2.5px solid #EA580C' : '2.5px solid transparent',
                  background: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderTop: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                💬 留言紀錄 ({activityLog.length})
              </button>
            </div>
          )}

          <div className="row-edit-modal-form-body" style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px 18px 24px' : '24px 32px 32px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {fields.filter(field => field.type !== 'activity_log').map(field => {
                const fieldKey = `field_${field.id}`
                const value = formData[fieldKey] ?? ''
                const isAdvanced = ['collaborator', 'single_select', 'multiple_select', 'link_row', 'file', 'attachment', 'latest_comment'].includes(field.type)

                return (
                  <li key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {FIELD_TYPE_ICONS[field.type] ? FIELD_TYPE_ICONS[field.type]() : <Info size={14} />}
                        {field.name}
                      </label>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                        title="Field info"
                      >
                        <Info size={14} />
                      </button>
                    </div>

                    {/* Field Input Control Element */}
                    <div>
                      {isAdvanced ? (
                        <AdvancedFieldInputs
                          field={field}
                          value={value}
                          onChange={(val) => {
                            handleChange(field.id, val, true)
                            commitFieldChangeLog(fieldKey, val)
                          }}
                          onUpdateField={onUpdateField}
                          readOnly={readOnly}
                        />
                      ) : field.type === 'long_text' ? (
                        <textarea
                          className="input"
                          value={value}
                          onFocus={() => handleFocusField(fieldKey)}
                          onChange={e => handleChange(field.id, e.target.value, false)}
                          onBlur={e => commitFieldChangeLog(fieldKey, e.target.value)}
                          rows={4}
                          placeholder="請輸入內容..."
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#0f172a',
                            wordBreak: 'break-all',
                            outline: 'none',
                            transition: 'border-color 0.15s ease',
                            lineHeight: '1.6',
                            resize: 'vertical',
                          }}
                        />
                      ) : field.type === 'formula' ? (
                        <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0, color: '#334155' }}>
                            {renderFormulaCell(value)}
                          </div>
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>公式唯讀</span>
                        </div>
                      ) : ['lookup', 'rollup', 'count', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber', 'uuid'].includes(field.type) ? (
                        <div style={{ padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span>{value !== null && value !== undefined ? String(value) : ''}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>唯讀</span>
                        </div>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          step={field.type === 'number' ? 'any' : undefined}
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
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: '#0f172a',
                            outline: 'none',
                            transition: 'border-color 0.15s ease',
                          }}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Right Section: Activity Log & Comments Sidebar */}
        {!isSidebarCollapsed && (
          <div className="row-edit-modal-right" style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <RowCommentsPanel
              tableId={row.tableId}
              rowId={row.id}
              activityLog={activityLog}
              onUpdateActivityLog={(logs) => setActivityLog(logs)}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
