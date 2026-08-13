'use client'

import React, { useState, useEffect } from 'react'
import { Plus, X, Search, Link as LinkIcon } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'

interface LinkRowInputProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  readOnly?: boolean
}

export function LinkRowInput({ field, value, onChange, readOnly }: LinkRowInputProps) {
  const { t } = useI18n()
  const [isRelationOpen, setIsRelationOpen] = useState(false)
  const [relationSearch, setRelationSearch] = useState('')
  const [relationRows, setRelationRows] = useState<any[]>([])
  const [targetFields, setTargetFields] = useState<TableField[]>([])
  const [relationLoading, setRelationLoading] = useState(false)
  const [allTables, setAllTables] = useState<any[]>([])
  const [selectedTargetTableId, setSelectedTargetTableId] = useState<number | null>(null)

  useEffect(() => {
    if (field.type === 'link_row') {
      fetch('/api/tables')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAllTables(data)
        })
        .catch(() => {})
    }
  }, [field.type])

  let fieldOptions: any = {}
  try {
    if (field.options) {
      fieldOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
    }
  } catch {}

  const effectiveTargetTableId = selectedTargetTableId || Number(
    fieldOptions?.targetTableId ??
    fieldOptions?.relationTableId ??
    fieldOptions?.link_table_id ??
    fieldOptions?.target_table_id ??
    fieldOptions?.table_id ??
    (field as any)?.targetTableId ??
    (allTables.length > 0 ? allTables[0].id : 0)
  ) || (allTables.length > 0 ? allTables[0].id : null)

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

  const parseLinkRowIds = (val: any): number[] => {
    return parseLinkRowItems(val).map(item => item.id)
  }

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

  const handleOpenRelationModal = () => {
    if (readOnly) return
    setIsRelationOpen(true)
    setRelationSearch('')
    if (effectiveTargetTableId) {
      fetchTargetFields(effectiveTargetTableId)
      fetchRelationRowsServerSide(effectiveTargetTableId, '')
    }
  }

  useEffect(() => {
    if (field.type === 'link_row' && effectiveTargetTableId) {
      fetchTargetFields(effectiveTargetTableId)
      fetchRelationRowsServerSide(effectiveTargetTableId, '')
    }
  }, [field.type, effectiveTargetTableId])

  useEffect(() => {
    if (!isRelationOpen || !effectiveTargetTableId) return
    const timer = setTimeout(() => {
      fetchRelationRowsServerSide(effectiveTargetTableId, relationSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [relationSearch, isRelationOpen, effectiveTargetTableId])

  const toggleLinkRow = (targetRow: any) => {
    if (readOnly) return
    const currentItems = parseLinkRowItems(value)
    const targetId = targetRow.id
    const isLinked = currentItems.some(i => i.id === targetId)

    if (isLinked) {
      const nextItems = currentItems.filter(i => i.id !== targetId)
      onChange(nextItems)
    } else {
      const primaryField = targetFields[0]
      const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(targetRow.data || {})[0]
      const primaryVal = String(targetRow.data?.[primaryKey] ?? `列 ID: ${targetId}`)

      const nextItems = [...currentItems, { id: targetId, value: primaryVal }]
      onChange(nextItems)
    }
  }

  const removeLinkRowItem = (targetId: number) => {
    if (readOnly) return
    const currentItems = parseLinkRowItems(value)
    const nextItems = currentItems.filter(i => i.id !== targetId)
    onChange(nextItems)
  }

  const linkedItems = parseLinkRowItems(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#ffffff',
          minHeight: '44px',
        }}
      >
        {linkedItems.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', paddingRight: '4px' }}>
            {t('modals.unlinked')}
          </span>
        ) : (
          linkedItems.map(item => (
            <span
              key={item.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                background: '#F4F4F5',
                border: 'none',
                borderRadius: '20px',
                fontSize: '12px',
                color: '#18181B',
                fontWeight: 600,
              }}
            >
              <LinkIcon size={12} />
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
                    color: '#18181B',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={t('modals.removeLink')}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))
        )}

        {!readOnly && (
          <button
            onClick={handleOpenRelationModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: '#F4F4F5',
              border: '1px solid #E4E4E7',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#18181B',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-blue-100 hover:border-blue-300 active:scale-[0.96]"
            title={t('modals.selectLinkItem')}
          >
            <Plus size={13} />
            <span>Choose an option</span>
          </button>
        )}
      </div>

      {isRelationOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setIsRelationOpen(false)}
        >
          <div
            style={{
              width: '820px',
              maxWidth: '95vw',
              height: '600px',
              maxHeight: '90vh',
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 30px 60px -12px rgba(15,23,42,0.3)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                <Search size={16} color="#64748b" />
                <input
                  type="text"
                  placeholder={t('modals.searchLinkRow')}
                  value={relationSearch}
                  onChange={e => setRelationSearch(e.target.value)}
                  style={{ flex: 1, padding: '8px 14px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '10px', outline: 'none', background: '#ffffff' }}
                />
                {allTables.length > 1 && (
                  <select
                    value={effectiveTargetTableId || ''}
                    onChange={(e) => {
                      const newId = Number(e.target.value)
                      setSelectedTargetTableId(newId)
                      fetchTargetFields(newId)
                      fetchRelationRowsServerSide(newId, relationSearch)
                    }}
                    style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '12px', outline: 'none', background: '#ffffff', color: '#1e293b', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {allTables.map(item => (
                      <option key={item.id} value={item.id}>{t('advancedInputs.linkedTable', { name: item.name })}</option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#18181B', background: '#F4F4F5', padding: '4px 10px', borderRadius: '12px' }}>
                  {t('modals.selectedItemsCount', { count: parseLinkRowIds(value).length })}
                </span>
                <button
                  onClick={() => setIsRelationOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
              {relationLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
                  {t('modals.loadingLinkData')}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ width: '48px', padding: '12px', textAlign: 'center' }}>{t('modals.selectHeader')}</th>
                      {targetFields.map(f => (
                        <th key={f.id} style={{ padding: '12px 14px', fontWeight: 600, color: '#334155', borderRight: '1px solid #f1f5f9' }}>
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {relationRows.length === 0 ? (
                      <tr>
                        <td colSpan={targetFields.length + 1} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontStyle: 'italic' }}>
                          {t('modals.noMatchingLinkRow')}
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
                              borderBottom: '1px solid #f1f5f9',
                              background: isLinked ? '#F4F4F5' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                          >
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isLinked}
                                onChange={() => {}}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#18181B' }}
                              />
                            </td>
                            {targetFields.map(f => {
                              const fKey = `field_${f.id}`
                              const cellVal = r.data?.[fKey]
                              const displayCell = cellVal == null || cellVal === '' ? '' : (typeof cellVal === 'boolean' ? (cellVal ? '✓' : '') : String(cellVal))

                              return (
                                <td key={f.id} style={{ padding: '12px 14px', color: '#1e293b', borderRight: '1px solid #f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                onClick={() => setIsRelationOpen(false)}
                style={{ padding: '8px 20px', background: '#18181B', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
