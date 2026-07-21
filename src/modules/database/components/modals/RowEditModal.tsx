'use client'

import React, { useState, useEffect } from 'react'
import type { TableField, TableRow } from '@/modules/database/types'

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
  onNavigateNext
}: RowEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})

  useEffect(() => {
    if (row) {
      setFormData(row.data || {})
    }
  }, [row])

  if (!show || !row) return null

  const handleChange = (fieldId: number, value: any) => {
    const key = `field_${fieldId}`
    setFormData(prev => ({ ...prev, [key]: value }))
    onUpdateCell?.(row.id, key, value)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="modal__box modal__box--with-sidebar" 
        onClick={e => e.stopPropagation()}
        style={{ width: '600px', maxWidth: '90vw', maxHeight: '85vh', backgroundColor: '#fff', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
      >
        {/* Header Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
              Row #{rowIndex !== undefined ? rowIndex + 1 : row.id}
            </span>
            {totalRows !== undefined && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                ({(rowIndex || 0) + 1} of {totalRows})
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

        {/* Fields List */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <ul className="row-modal__field-list" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map(field => {
              const fieldKey = `field_${field.id}`
              const value = formData[fieldKey] ?? ''

              return (
                <li key={field.id} className="row-modal__field-item">
                  <div className="control">
                    <label className="control__label control__label--small" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                      <i className={`baserow-icon-${field.type}`} style={{ marginRight: '6px' }}></i>
                      {field.name}
                    </label>
                    <div className="control__elements">
                      {field.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={value === 'true' || value === true || value === '1'}
                          onChange={e => handleChange(field.id, e.target.checked ? 'true' : 'false')}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      ) : field.type === 'long_text' ? (
                        <textarea
                          className="input input--large"
                          value={value}
                          onChange={e => handleChange(field.id, e.target.value)}
                          rows={3}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          className="input input--large"
                          value={value}
                          onChange={e => handleChange(field.id, e.target.value)}
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
      </div>
    </div>
  )
}
