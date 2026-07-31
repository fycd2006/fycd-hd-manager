'use client'

import React, { useState, useEffect } from 'react'
import { Plus, X, Search, Check, Link as LinkIcon, Paperclip } from 'lucide-react'
import type { TableField } from '@/modules/database/types'

export interface AttachmentFile {
  url: string
  name: string
  size?: number
}

interface AdvancedFieldInputsProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => Promise<void>
  readOnly?: boolean
}

const getTagStyle = (idx: number) => {
  const colors = [
    { bg: '#F4F4F5', border: '#E4E4E7', text: '#2d470d' },
    { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
    { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
    { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' },
  ]
  return colors[idx % colors.length]
}

export const AdvancedFieldInputs: React.FC<AdvancedFieldInputsProps> = ({
  field,
  value,
  onChange,
  onUpdateField,
  readOnly = false,
}) => {
  const fieldKey = `field_${field.id}`

  // link_row states
  const [isRelationOpen, setIsRelationOpen] = useState(false)
  const [relationSearch, setRelationSearch] = useState('')
  const [relationRows, setRelationRows] = useState<any[]>([])
  const [targetFields, setTargetFields] = useState<TableField[]>([])
  const [relationLoading, setRelationLoading] = useState(false)
  const [allTables, setAllTables] = useState<any[]>([])
  const [selectedTargetTableId, setSelectedTargetTableId] = useState<number | null>(null)

  // Fetch all workspace tables as fallback if field targetTableId is missing
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

  // Parse field options JSON
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

  const cleanChoice = (item: any): string[] => {
    if (item === null || item === undefined || item === '') return []
    if (typeof item === 'object') {
      if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice)
      if (Array.isArray(item.select_options)) return item.select_options.flatMap(cleanChoice)
      if (Array.isArray(item.options)) return item.options.flatMap(cleanChoice)
      if (item.value || item.name || item.id) return [String(item.value || item.name || item.id)]
      return [String(item)]
    }
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (!trimmed) return []
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"{\\') || trimmed.startsWith('"{')) {
        try {
          let parsed = JSON.parse(trimmed)
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed) } catch {}
          }
          return cleanChoice(parsed)
        } catch {}
      }
      return [trimmed]
    }
    return [String(item)]
  }

  // Parse options list for select fields
  const getSelectChoices = (): string[] => {
    let rawItems: any[] = []
    let opts: any = field.options
    if (typeof opts === 'string') {
      try {
        let parsed = JSON.parse(opts)
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {}
        }
        opts = parsed
      } catch {}
    }
    if (Array.isArray(opts)) {
      rawItems = opts
    } else if (opts && typeof opts === 'object') {
      if (Array.isArray(opts.choices)) rawItems = opts.choices
      else if (Array.isArray(opts.select_options)) rawItems = opts.select_options
      else if (Array.isArray(opts.options)) rawItems = opts.options
    }

    if (rawItems.length === 0 && typeof field.options === 'string' && field.options.trim()) {
      rawItems = field.options.split(',')
    }
    const cleaned = rawItems.flatMap(cleanChoice)
    const selected = parseSelectValues(value)
    const combined = Array.from(new Set([...cleaned, ...selected]))
    return combined.filter(Boolean)
  }

  // Parse current select values
  const parseSelectValues = (val: any): string[] => {
    if (val == null || val === '') return []
    if (Array.isArray(val)) return val.flatMap(cleanChoice)
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed.flatMap(cleanChoice)
      } catch {}
      return val.split(',').flatMap(cleanChoice)
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

  const toggleSelectOption = (choice: string, isMulti: boolean) => {
    if (readOnly) return
    const selected = parseSelectValues(value)
    if (isMulti) {
      const next = selected.includes(choice) ? selected.filter(s => s !== choice) : [...selected, choice]
      onChange(next)
    } else {
      const next = selected.includes(choice) ? [] : [choice]
      onChange(next.length ? next[0] : '')
    }
  }

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

  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  const handleAddNewTag = async (isMulti: boolean) => {
    if (!newTagInput.trim() || readOnly) return
    const tagVal = newTagInput.trim()

    // 1. Select the new tag immediately
    toggleSelectOption(tagVal, isMulti)

    // 2. Persist new option choice back to Field options schema if onUpdateField is provided
    if (onUpdateField) {
      let currentChoices = getSelectChoices()
      if (!currentChoices.includes(tagVal)) {
        const updatedChoices = [...currentChoices, tagVal]
        let currentOptions: any = {}
        try {
          if (field.options) {
            currentOptions = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
          }
        } catch {}

        const newOptions = typeof field.options === 'string'
          ? JSON.stringify({ ...currentOptions, choices: updatedChoices })
          : { ...currentOptions, choices: updatedChoices }

        await onUpdateField(field.id, { options: newOptions as any })
      }
    }

    setNewTagInput('')
    setIsAddingTag(false)
  }

  // RENDER: Single & Multiple Select (Soft Rounded Pills)
  if (field.type === 'single_select' || field.type === 'multiple_select') {
    const isMulti = field.type === 'multiple_select'
    const choices = getSelectChoices()
    const selectedList = parseSelectValues(value)

    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px', background: '#ffffff' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {choices.map((choice, idx) => {
            const isSelected = selectedList.includes(choice)
            const tagStyle = getTagStyle(idx)

            return (
              <span
                key={choice}
                onClick={() => toggleSelectOption(choice, isMulti)}
                style={{
                  cursor: readOnly ? 'default' : 'pointer',
                  fontSize: '12px',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  userSelect: 'none',
                  background: isSelected ? tagStyle.bg : '#f8fafc',
                  border: `1px solid ${isSelected ? tagStyle.border : '#e2e8f0'}`,
                  color: isSelected ? tagStyle.text : '#475569',
                  fontWeight: isSelected ? 600 : 500,
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {choice}
                {isSelected && <Check size={12} />}
              </span>
            )
          })}

          {!readOnly && (
            isAddingTag ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  autoFocus
                  placeholder="輸入新選項..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddNewTag(isMulti)
                    } else if (e.key === 'Escape') {
                      setIsAddingTag(false)
                      setNewTagInput('')
                    }
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    border: '1px solid #E4E4E7',
                    borderRadius: '16px',
                    outline: 'none',
                    width: '120px',
                    background: '#ffffff'
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddNewTag(isMulti)}
                  style={{
                    background: '#18181B',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  新增
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingTag(false); setNewTagInput(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingTag(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                className="hover:border-indigo-400 hover:text-[#3F6212] hover:bg-[#F4F4F5]/50"
              >
                <Plus size={12} />
                <span>+ Choose an option</span>
              </button>

            )
          )}
        </div>
      </div>
    )
  }

  // RENDER: File / Attachment
  if (field.type === 'file' || field.type === 'attachment') {
    const parseAttachmentFiles = (val: any): AttachmentFile[] => {
      if (val == null || val === '') return []
      let list: any[] = []
      if (Array.isArray(val)) list = val
      else if (typeof val === 'string' && val.trim()) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) list = parsed
          else list = [parsed]
        } catch {
          list = [{ url: val, name: val.split('/').pop() || '附件檔案' }]
        }
      } else if (typeof val === 'object') {
        list = [val]
      }
      return list.map(item => {
        if (typeof item === 'object' && item !== null) {
          return {
            url: String(item.url || item.path || ''),
            name: String(item.name || item.filename || item.url?.split('/').pop() || '附件檔案'),
            size: item.size
          }
        }
        return { url: String(item), name: String(item).split('/').pop() || '附件檔案' }
      }).filter(f => Boolean(f.url || f.name))
    }

    const files = parseAttachmentFiles(value)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0 || readOnly) return
      const uploadedFiles: AttachmentFile[] = Array.from(e.target.files).map(f => ({
        url: URL.createObjectURL(f),
        name: f.name,
        size: f.size
      }))
      const nextFiles = [...files, ...uploadedFiles]
      onChange(nextFiles)
    }

    const removeFile = (idx: number) => {
      if (readOnly) return
      const nextFiles = files.filter((_, i) => i !== idx)
      onChange(nextFiles)
    }

    return (
      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {files.length === 0 ? (
            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>尚無附件檔</span>
          ) : (
            files.map((file, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#1e293b',
                  fontWeight: 500
                }}
              >
                <Paperclip size={14} color="#3F6212" />
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#18181B', textDecoration: 'underline', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {file.name}
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {!readOnly && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: '#F4F4F5',
              border: '1px solid #E4E4E7',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#18181B',
              cursor: 'pointer',
              alignSelf: 'flex-start',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={13} />
            <span>上傳附件檔案</span>
            <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        )}
      </div>
    )
  }

  // RENDER: Link Row
  if (field.type === 'link_row') {
    const linkedItems = parseLinkRowItems(value)
    const targetTableId = fieldOptions.targetTableId

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Linked Row Tag Container */}
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
                    title="移除關聯"
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
              title="選擇關聯項目"
            >
              <Plus size={13} />
              <span>Choose an option</span>
            </button>

          )}
        </div>

        {/* Relation Picker Modal */}
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
              {/* Modal Top Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <Search size={16} color="#64748b" />
                  <input
                    type="text"
                    placeholder="搜尋關聯列 (支援全欄位比對)..."
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
                      {allTables.map(t => (
                        <option key={t.id} value={t.id}>關聯表: {t.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#18181B', background: '#F4F4F5', padding: '4px 10px', borderRadius: '12px' }}>
                    已選擇 {parseLinkRowIds(value).length} 項
                  </span>
                  <button
                    onClick={() => setIsRelationOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
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
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ width: '48px', padding: '12px', textAlign: 'center' }}>選取</th>
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

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <button
                  onClick={() => setIsRelationOpen(false)}
                  style={{ padding: '8px 20px', background: '#18181B', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
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
