'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Table as TableIcon, Loader2, AlertCircle } from 'lucide-react'
import type { TableField, TableRow } from '@/modules/database/types'
import { FIELD_TYPE_ICONS } from '@/modules/database/constants'
import AdvancedFieldInputs from '../modals/AdvancedFieldInputs'
import { formatDateValue } from '@/modules/database/utils'
import { renderFormulaCell } from '../views/grid/GridViewCell'
import { safeJsonParse } from '@/lib/json-utils'

export interface CardDrawerProps {
  show: boolean
  tableId: number | null
  rowId: number | null
  tableName?: string
  onClose: () => void
  onRowUpdated?: (rowId: number, data: Record<string, any>) => void
  readOnly?: boolean
  isMasterViewContext?: boolean
}

export const CardDrawer: React.FC<CardDrawerProps> = ({
  show,
  tableId,
  rowId,
  tableName,
  onClose,
  onRowUpdated,
  readOnly = false,
  isMasterViewContext = false,
}) => {

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<TableField[]>([])
  const [row, setRow] = useState<TableRow | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const focusValuesRef = useRef<Record<string, any>>({})

  // Fetch schema and row data whenever drawer opens or tableId/rowId changes
  useEffect(() => {
    if (!show || !tableId || !rowId) {
      setFields([])
      setRow(null)
      setFormData({})
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/tables/${tableId}/fields`),
      fetch(`/api/tables/${tableId}/rows?page=1&pageSize=100`),
    ])
      .then(async ([fieldsRes, rowsRes]) => {
        if (!fieldsRes.ok) {
          const err = await fieldsRes.json().catch(() => ({}))
          throw new Error(err.error || `無法取得資料表欄位 (狀態碼: ${fieldsRes.status})`)
        }
        if (!rowsRes.ok) {
          const err = await rowsRes.json().catch(() => ({}))
          throw new Error(err.error || `無法取得資料列 (狀態碼: ${rowsRes.status})`)
        }

        const fieldsData = await fieldsRes.json()
        const rowsData = await rowsRes.json()

        if (!isMounted) return

        const rowsArray = Array.isArray(rowsData) ? rowsData : rowsData.rows || []
        const foundRow = rowsArray.find((r: any) => r.id === rowId)

        if (!foundRow) {
          throw new Error(`找不到 ID 為 ${rowId} 的資料列或已被刪除`)
        }

        setFields(Array.isArray(fieldsData) ? fieldsData : [])
        setRow(foundRow)
        setFormData(foundRow.data ? safeJsonParse(foundRow.data, {}) : {})
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [show, tableId, rowId])

  // Close on Escape key
  useEffect(() => {
    if (!show) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, onClose])

  const handleUpdateCell = async (fieldKey: string, value: any) => {
    if (!tableId || !rowId || readOnly) return

    setFormData((prev) => ({ ...prev, [fieldKey]: value }))
    setSavingKey(fieldKey)
    setSaveError(null)

    try {
      const res = await fetch(`/api/tables/${tableId}/rows`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, fieldKey, value }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `更新失敗 (${res.status})`)
      }

      const updatedRow = await res.json()
      const updatedData = updatedRow.data ? safeJsonParse(updatedRow.data, {}) : { ...formData, [fieldKey]: value }
      setFormData(updatedData)
      if (onRowUpdated) {
        onRowUpdated(rowId, updatedData)
      }
    } catch (err: any) {
      setSaveError(err.message || '更新失敗')
    } finally {
      setSavingKey(null)
    }
  }

  if (!show) return null
  if (typeof document === 'undefined') return null

  const primaryField = fields.find((f) => f.order === 0) || fields[0]
  const primaryFieldKey = primaryField ? `field_${primaryField.id}` : null
  const rowTitle =
    primaryFieldKey && formData[primaryFieldKey] != null && String(formData[primaryFieldKey]).trim()
      ? String(formData[primaryFieldKey])
      : rowId
      ? `資料列 #${rowId}`
      : '關聯列詳情'

  return createPortal(
    <div
      data-testid="card-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'cardDrawerFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes cardDrawerFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(4px); }
        }
        @keyframes cardDrawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes cardDrawerItemFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardDrawerShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .card-drawer-skeleton-shimmer {
          background: linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%);
          background-size: 200% 100%;
          animation: cardDrawerShimmer 1.5s infinite;
        }
        .card-drawer-card-item {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .card-drawer-card-item:hover {
          border-color: #d4d4d8 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
        }
        .card-drawer-input {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .card-drawer-input:focus {
          border-color: #84cc16 !important;
          box-shadow: 0 0 0 3px rgba(132, 204, 22, 0.15) !important;
        }
        .card-drawer-close-btn {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card-drawer-close-btn:hover {
          background: #f4f4f5 !important;
          color: #18181b !important;
          transform: rotate(90deg);
        }
      `}</style>
      <div
        data-testid="card-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '500px',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-12px 0 40px -4px rgba(0, 0, 0, 0.16), -2px 0 12px -2px rgba(0, 0, 0, 0.08)',
          borderLeft: '1px solid rgba(228, 228, 231, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'cardDrawerSlideIn 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e4e4e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4.5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#3F6212',
                  background: '#f7fee7',
                  border: '1px solid #d9f99d',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                <TableIcon size={12} />
                <span>{tableName || `資料表 #${tableId}`}</span>
              </span>
              {rowId && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    color: '#71717a',
                    background: '#f4f4f5',
                    padding: '2px 6px',
                    borderRadius: '6px',
                  }}
                >
                  #{rowId}
                </span>
              )}
              {readOnly && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#71717a',
                    background: '#f4f4f5',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  唯讀
                </span>
              )}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 700,
                color: '#18181b',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={rowTitle}
            >
              {rowTitle}
            </h2>
          </div>

          <button
            type="button"
            data-testid="card-drawer-close"
            className="card-drawer-close-btn"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#71717a',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Master View Context Info Banner */}
        {isMasterViewContext && (
          <div
            data-testid="master-view-drawer-banner"
            style={{
              background: '#f0fdf4',
              color: '#166534',
              borderBottom: '1px solid #bbf7d0',
              padding: '10px 20px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: '1.4',
            }}
          >
            <TableIcon size={14} color="#16a34a" style={{ flexShrink: 0 }} />
            <span>
              <strong>總表編輯情境</strong>：在此修改將即時同步至來源子表「{tableName || `資料表 #${tableId}`}」；若總表有專屬覆寫，總表將優先套用覆寫值。
            </span>
          </div>
        )}

        {/* Save error toast */}
        {saveError && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              borderBottom: '1px solid #fee2e2',
              padding: '8px 20px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{saveError}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#fafafa' }}>
          {loading ? (
            <div data-testid="card-drawer-loading" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Skeleton header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Loader2 size={15} className="animate-spin" style={{ color: '#3F6212' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#71717a' }}>載入資料列詳情中...</span>
              </div>
              {/* Skeleton Cards */}
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #e4e4e7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="card-drawer-skeleton-shimmer" style={{ width: '20px', height: '20px', borderRadius: '5px' }} />
                    <div className="card-drawer-skeleton-shimmer" style={{ width: `${60 + i * 20}px`, height: '14px', borderRadius: '4px' }} />
                  </div>
                  <div className="card-drawer-skeleton-shimmer" style={{ width: '100%', height: i === 2 ? '54px' : '36px', borderRadius: '8px' }} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div
              data-testid="card-drawer-error"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                color: '#ef4444',
                textAlign: 'center',
                gap: '8px',
                padding: '0 20px',
              }}
            >
              <AlertCircle size={32} />
              <div style={{ fontWeight: 600, fontSize: '14px' }}>讀取失敗</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>{error}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {fields.map((field, idx) => {
                const fieldKey = `field_${field.id}`
                const value = formData[fieldKey]
                const IconComponent = (FIELD_TYPE_ICONS[field.type as keyof typeof FIELD_TYPE_ICONS] || TableIcon) as React.ComponentType<{ size?: number; color?: string; className?: string }>
                const isSaving = savingKey === fieldKey
                const isReadOnlyField =
                  readOnly ||
                  ['autonumber', 'created_on', 'created_by', 'last_modified_on', 'last_modified_by', 'formula', 'lookup', 'rollup'].includes(
                    field.type
                  )
                const isLongTextLike =
                  field.type === 'long_text' ||
                  (typeof value === 'string' && value.includes('\n')) ||
                  /介紹|說明|備註|描述|內容|note|desc|content|comment/i.test(field.name)

                return (
                  <div
                    key={field.id}
                    className="card-drawer-card-item"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      padding: '12px 14px',
                      background: '#ffffff',
                      border: '1px solid #e4e4e7',
                      borderRadius: '12px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                      animation: 'cardDrawerItemFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards',
                      animationDelay: `${Math.min(idx * 35, 240)}ms`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#27272a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <div
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: '#f4f4f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#52525b',
                          }}
                        >
                          <IconComponent size={13} />
                        </div>
                        <span>{field.name}</span>
                      </label>
                      {isSaving && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#15803d',
                            background: '#f0fdf4',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Loader2 size={11} className="animate-spin" />
                          <span>儲存中</span>
                        </span>
                      )}
                    </div>

                    {/* Field Value Editor / Renderer */}
                    {['collaborator', 'single_select', 'multiple_select', 'link_row', 'file', 'attachment', 'latest_comment'].includes(field.type) ? (
                      <AdvancedFieldInputs
                        field={field}
                        value={value}
                        onChange={(newVal) => handleUpdateCell(fieldKey, newVal)}
                        readOnly={isReadOnlyField}
                      />
                    ) : field.type === 'formula' ? (
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#0f172a',
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          fontFamily: 'monospace',
                        }}
                      >
                        {renderFormulaCell(value)}
                      </div>
                    ) : field.type === 'date' || field.type === 'created_on' || field.type === 'last_modified_on' ? (
                      isReadOnlyField ? (
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#71717a',
                            padding: '8px 12px',
                            background: '#f4f4f5',
                            borderRadius: '8px',
                            border: '1px solid #e4e4e7',
                          }}
                        >
                          {formatDateValue(value) || '-'}
                        </div>
                      ) : (
                        <input
                          type="date"
                          className="card-drawer-input"
                          value={value ? String(value).split('T')[0] : ''}
                          onChange={(e) => handleUpdateCell(fieldKey, e.target.value)}
                          style={{
                            width: '100%',
                            fontSize: '13px',
                            padding: '8px 12px',
                            border: '1px solid #e4e4e7',
                            borderRadius: '8px',
                            outline: 'none',
                            background: '#ffffff',
                          }}
                        />
                      )
                    ) : field.type === 'boolean' ? (
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isReadOnlyField ? 'default' : 'pointer',
                          padding: '4px 0',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          disabled={isReadOnlyField}
                          onChange={(e) => handleUpdateCell(fieldKey, e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: '#4d7c0f', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#3f3f46' }}>{value ? '是 (True)' : '否 (False)'}</span>
                      </label>
                    ) : field.type === 'number' ? (
                      <input
                        type="number"
                        className="card-drawer-input"
                        value={value ?? ''}
                        disabled={isReadOnlyField}
                        onFocus={() => {
                          focusValuesRef.current[fieldKey] = value
                        }}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value)
                          setFormData((prev) => ({ ...prev, [fieldKey]: val }))
                        }}
                        onBlur={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value)
                          if (val !== focusValuesRef.current[fieldKey]) {
                            handleUpdateCell(fieldKey, val)
                          }
                        }}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          padding: '8px 12px',
                          border: '1px solid #e4e4e7',
                          borderRadius: '8px',
                          outline: 'none',
                          background: isReadOnlyField ? '#f4f4f5' : '#ffffff',
                          color: '#18181b',
                        }}
                      />
                    ) : isReadOnlyField ? (
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#71717a',
                          padding: '8px 12px',
                          background: '#f4f4f5',
                          borderRadius: '8px',
                          border: '1px solid #e4e4e7',
                        }}
                      >
                        {value != null ? String(value) : '-'}
                      </div>
                    ) : isLongTextLike ? (
                      <textarea
                        className="card-drawer-input"
                        rows={3}
                        value={value ?? ''}
                        onFocus={() => {
                          focusValuesRef.current[fieldKey] = value
                        }}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData((prev) => ({ ...prev, [fieldKey]: val }))
                        }}
                        onBlur={(e) => {
                          const val = e.target.value
                          if (val !== focusValuesRef.current[fieldKey]) {
                            handleUpdateCell(fieldKey, val)
                          }
                        }}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          padding: '8px 12px',
                          border: '1px solid #e4e4e7',
                          borderRadius: '8px',
                          outline: 'none',
                          resize: 'vertical',
                          minHeight: '68px',
                          background: '#ffffff',
                          color: '#18181b',
                          fontFamily: 'inherit',
                        }}
                      />
                    ) : (
                      <input
                        type="text"
                        className="card-drawer-input"
                        value={value ?? ''}
                        onFocus={() => {
                          focusValuesRef.current[fieldKey] = value
                        }}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData((prev) => ({ ...prev, [fieldKey]: val }))
                        }}
                        onBlur={(e) => {
                          const val = e.target.value
                          if (val !== focusValuesRef.current[fieldKey]) {
                            handleUpdateCell(fieldKey, val)
                          }
                        }}
                        style={{
                          width: '100%',
                          fontSize: '13px',
                          padding: '8px 12px',
                          border: '1px solid #e4e4e7',
                          borderRadius: '8px',
                          outline: 'none',
                          background: '#ffffff',
                          color: '#18181b',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default CardDrawer
