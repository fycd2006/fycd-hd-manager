'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { TableField } from '@/modules/database/types'

export interface AttachmentFile {
  url: string
  name: string
  size?: number
}

interface AdvancedFieldInputsProps {
  field: TableField
  value: any
  onChange: (fieldKey: string, nextValue: any) => void
  readOnly?: boolean
}

const getTagStyle = (idx: number) => {
  const colors = [
    { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
    { bg: '#d1fae5', border: '#6ee7b7', text: '#047857' },
    { bg: '#fef3c7', border: '#fcd34d', text: '#b45309' },
    { bg: '#fee2e2', border: '#fca5a5', text: '#b91c1c' },
    { bg: '#ede9fe', border: '#c4b5fd', text: '#6d28d9' },
    { bg: '#fce7f3', border: '#f9a8d4', text: '#be185d' },
  ]
  return colors[idx % colors.length]
}

export const AdvancedFieldInputs: React.FC<AdvancedFieldInputsProps> = ({
  field,
  value,
  onChange,
  readOnly = false,
}) => {
  const fieldKey = `field_${field.id}`

  // link_row states
  const [isRelationOpen, setIsRelationOpen] = useState(false)
  const [relationSearch, setRelationSearch] = useState('')
  const [relationRows, setRelationRows] = useState<any[]>([])
  const [targetFields, setTargetFields] = useState<TableField[]>([])
  const [relationLoading, setRelationLoading] = useState(false)

  // Parse field options JSON
  let fieldOptions: any = {}
  try {
    if (field.options) {
      fieldOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
    }
  } catch {}

  // Parse options list for select fields
  const getSelectChoices = (): string[] => {
    if (Array.isArray(fieldOptions)) return fieldOptions.map(String)
    if (Array.isArray(fieldOptions?.choices)) return fieldOptions.choices.map(String)
    if (Array.isArray(fieldOptions?.select_options)) return fieldOptions.select_options.map(String)
    if (typeof field.options === 'string' && !field.options.startsWith('{')) {
      return field.options.split(',').map(s => s.trim()).filter(Boolean)
    }
    return []
  }

  // Parse current select values
  const parseSelectValues = (val: any): string[] => {
    if (val == null || val === '') return []
    if (Array.isArray(val)) return val.map(String)
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed.map(String)
      } catch {}
      return val.split(',').map(s => s.trim()).filter(Boolean)
    }
    return [String(val)]
  }



  // Parse current link_row target row items
  const parseLinkRowItems = (val: any): Array<{ id: number; value: string }> => {
    if (val == null || val === '') return []
    let rawList = val
    if (typeof val === 'string' && val.trim()) {
      try {
        rawList = JSON.parse(val)
      } catch {
        rawList = []
      }
    }
    if (Array.isArray(rawList)) {
      const primaryField = targetFields[0]
      const primaryKey = primaryField ? `field_${primaryField.id}` : null

      return rawList.flatMap(item => {
        if (typeof item === 'object' && item !== null && 'id' in item) {
          const numId = Number((item as any).id)
          if (isNaN(numId)) return []
          let label = String((item as any).value || '')
          if (!label || label.startsWith('列 ID:')) {
            const rowInRelation = relationRows.find(r => r.id === numId)
            if (rowInRelation && primaryKey && rowInRelation.data?.[primaryKey]) {
              label = String(rowInRelation.data[primaryKey])
            }
          }
          return [{ id: numId, value: label || `列 ID: ${numId}` }]
        }
        if (typeof item === 'number' && !isNaN(item)) {
          let label = ''
          const rowInRelation = relationRows.find(r => r.id === item)
          if (rowInRelation && primaryKey && rowInRelation.data?.[primaryKey]) {
            label = String(rowInRelation.data[primaryKey])
          }
          return [{ id: item, value: label || `列 ID: ${item}` }]
        }
        if (typeof item === 'string') {
          const numId = Number(item)
          if (!isNaN(numId)) {
            let label = ''
            const rowInRelation = relationRows.find(r => r.id === numId)
            if (rowInRelation && primaryKey && rowInRelation.data?.[primaryKey]) {
              label = String(rowInRelation.data[primaryKey])
            }
            return [{ id: numId, value: label || `列 ID: ${numId}` }]
          }
        }
        return []
      })
    }
    return []
  }

  // Parse current link_row target row IDs
  const parseLinkRowIds = (val: any): number[] => {
    return parseLinkRowItems(val).map(item => item.id)
  }

  // -------------------------------------------------------------
  // Fetch target table fields & server-side search rows
  // -------------------------------------------------------------
  const fetchTargetFields = async (targetTableId: number) => {
    try {
      const res = await fetch(`/api/tables/${targetTableId}/fields`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          data.sort((a, b) => (a.order || 0) - (b.order || 0))
          setTargetFields(data)
        }
      }
    } catch (e) {
      console.error('Failed to fetch target fields:', e)
    }
  }

  const fetchRelationRowsServerSide = async (targetTableId: number, searchKeyword: string) => {
    setRelationLoading(true)
    try {
      const url = searchKeyword.trim()
        ? `/api/tables/${targetTableId}/rows?search=${encodeURIComponent(searchKeyword.trim())}&page=1&pageSize=30`
        : `/api/tables/${targetTableId}/rows?page=1&pageSize=30`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const rowsArray = Array.isArray(data) ? data : (data.rows || [])
        setRelationRows(rowsArray)
      }
    } catch (e) {
      console.error('Failed to fetch relation rows:', e)
    } finally {
      setRelationLoading(false)
    }
  }

  // Open modal and fetch target table fields & rows
  const handleOpenRelationModal = () => {
    if (readOnly || !fieldOptions.targetTableId) return
    setIsRelationOpen(true)
    setRelationSearch('')
    fetchTargetFields(fieldOptions.targetTableId)
    fetchRelationRowsServerSide(fieldOptions.targetTableId, '')
  }

  // Pre-fetch target table metadata so raw IDs like [25, 27] can immediately resolve to Primary Field names
  useEffect(() => {
    if (field.type === 'link_row' && fieldOptions.targetTableId) {
      fetchTargetFields(fieldOptions.targetTableId)
      fetchRelationRowsServerSide(fieldOptions.targetTableId, '')
    }
  }, [field.type, fieldOptions.targetTableId])

  // Fetch when search input changes (debounced)
  useEffect(() => {
    if (!isRelationOpen || !fieldOptions.targetTableId) return
    const timer = setTimeout(() => {
      fetchRelationRowsServerSide(fieldOptions.targetTableId, relationSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [relationSearch, isRelationOpen, fieldOptions.targetTableId])



  // Toggle single/multi select
  const toggleSelectOption = (choice: string, isMulti: boolean) => {
    if (readOnly) return
    const selected = parseSelectValues(value)
    if (isMulti) {
      const next = selected.includes(choice) ? selected.filter(s => s !== choice) : [...selected, choice]
      onChange(fieldKey, next)
    } else {
      const next = selected.includes(choice) ? [] : [choice]
      onChange(fieldKey, next.length ? next[0] : '')
    }
  }

  // Toggle link_row target row
  const toggleLinkRow = (targetRow: any) => {
    if (readOnly) return
    const currentItems = parseLinkRowItems(value)
    const targetId = targetRow.id
    const isLinked = currentItems.some(i => i.id === targetId)

    if (isLinked) {
      const nextItems = currentItems.filter(i => i.id !== targetId)
      onChange(fieldKey, nextItems)
    } else {
      // Determine primary field (field with min order in targetFields)
      const primaryField = targetFields[0]
      const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(targetRow.data || {})[0]
      const primaryVal = String(targetRow.data?.[primaryKey] ?? `列 ID: ${targetId}`)

      const nextItems = [...currentItems, { id: targetId, value: primaryVal }]
      onChange(fieldKey, nextItems)
    }
  }

  const removeLinkRowItem = (targetId: number) => {
    if (readOnly) return
    const currentItems = parseLinkRowItems(value)
    const nextItems = currentItems.filter(i => i.id !== targetId)
    onChange(fieldKey, nextItems)
  }

  // RENDER: Single & Multiple Select
  if (field.type === 'single_select' || field.type === 'multiple_select') {
    const isMulti = field.type === 'multiple_select'
    const choices = getSelectChoices()
    const selectedList = parseSelectValues(value)

    return (
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', background: '#f8fafc' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {choices.length === 0 ? (
            <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>無可選標籤選項</span>
          ) : (
            choices.map((choice, idx) => {
              const isSelected = selectedList.includes(choice)
              const tagStyle = getTagStyle(idx)

              return (
                <span
                  key={choice}
                  onClick={() => toggleSelectOption(choice, isMulti)}
                  style={{
                    cursor: readOnly ? 'default' : 'pointer',
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    userSelect: 'none',
                    background: isSelected ? tagStyle.bg : '#ffffff',
                    border: `1px solid ${isSelected ? tagStyle.border : '#cbd5e1'}`,
                    color: isSelected ? tagStyle.text : '#64748b',
                    fontWeight: isSelected ? 600 : 400,
                    transition: 'all 0.1s ease',
                  }}
                >
                  {choice}
                </span>
              )
            })
          )}
        </div>
      </div>
    )
  }



  // RENDER: Link Row (Relation Picker with Baserow Tag Pills + Table-Style Grid Modal)
  if (field.type === 'link_row') {
    const linkedItems = parseLinkRowItems(value)
    const targetTableId = fieldOptions.targetTableId

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Linked Row Tag Container (Baserow Style) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            minHeight: '42px',
          }}
        >
          {linkedItems.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', paddingRight: '4px' }}>
              未選擇關聯項目
            </span>
          ) : (
            linkedItems.map(item => (
              <span
                key={item.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#1e293b',
                  fontWeight: 500,
                }}
              >
                <span>{item.value}</span>
                {!readOnly && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeLinkRowItem(item.id)
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: '13px',
                      lineHeight: 1,
                    }}
                    title="移除關聯"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )}

          {!readOnly && targetTableId && (
            <button
              onClick={handleOpenRelationModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2px 8px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="開啟關聯表選取器 Modal"
            >
              +
            </button>
          )}
        </div>

        {/* Spacious Baserow Table-Style Relation Picker Modal */}
        {isRelationOpen && targetTableId && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setIsRelationOpen(false)}
          >
            <div
              style={{
                width: '780px',
                maxWidth: '92vw',
                height: '560px',
                maxHeight: '85vh',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '400px' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search rows (支援全欄位比對)..."
                    value={relationSearch}
                    onChange={e => setRelationSearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    已選擇 {parseLinkRowIds(value).length} 項
                  </span>
                  <button
                    onClick={() => setIsRelationOpen(false)}
                    style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    ✕ 完成關閉
                  </button>
                </div>
              </div>

              {/* Table Grid View Body */}
              <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
                {relationLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
                    載入關聯表格資料中...
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    {/* Header Row */}
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                        <th style={{ width: '44px', padding: '10px 12px', textAlign: 'center' }}>選取</th>
                        {targetFields.map(f => (
                          <th key={f.id} style={{ padding: '10px 12px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {/* Rows Body */}
                    <tbody>
                      {relationRows.length === 0 ? (
                        <tr>
                          <td colSpan={targetFields.length + 1} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                            找不到符合條件的關聯列
                          </td>
                        </tr>
                      ) : (
                        relationRows.map(r => {
                          const currentIds = parseLinkRowIds(value)
                          const isLinked = currentIds.includes(r.id)

                          return (
                            <tr
                              key={r.id}
                              onClick={() => toggleLinkRow(r)}
                              style={{
                                borderBottom: '1px solid #e2e8f0',
                                background: isLinked ? '#f0fdf4' : 'transparent',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease',
                              }}
                            >
                              {/* Checkbox column */}
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() => {}} // handled by tr onClick
                                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                />
                              </td>

                              {/* Multi-column Values */}
                              {targetFields.map(f => {
                                const fKey = `field_${f.id}`
                                const cellVal = r.data?.[fKey]
                                const displayCell = cellVal == null || cellVal === '' ? '' : (typeof cellVal === 'boolean' ? (cellVal ? '✓' : '') : String(cellVal))

                                return (
                                  <td key={f.id} style={{ padding: '10px 12px', color: '#1e293b', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                                    {displayCell}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button
                  onClick={() => setIsRelationOpen(false)}
                  style={{ padding: '6px 16px', background: '#6366f1', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  確認
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

export default AdvancedFieldInputs
