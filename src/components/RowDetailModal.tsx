'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

type ActivityLogEntry = {
  id?: string
  content?: string
  user?: string
  time?: string
}

type CollaboratorUser = {
  id: number
  username?: string
  role?: string
}

type AttachmentFile = {
  url?: string
  name?: string
}

interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
  options: string | null
}

interface TableRow {
  id: number
  tableId: number
  data: Record<string, CellValue>
  order: number
  createdAt: string
}

interface DynamicTable {
  id: number
  name: string
}

interface RowComment {
  id: number
  content: string
  createdAt: string
  user: {
    username: string
    role: string
  }
}

interface RowDetailModalProps {
  isOpen: boolean
  onClose: () => void
  row: TableRow | null
  fields: TableField[]
  onUpdateCell: (rowId: number, fieldKey: string, value: CellValue) => Promise<void>
  currentUser: { username: string; role: string } | null
}

export default function RowDetailModal({
  isOpen,
  onClose,
  row,
  fields,
  onUpdateCell,
  currentUser,
}: RowDetailModalProps) {
  const [localData, setLocalData] = useState<Record<string, CellValue>>(row?.data ?? {})
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editingLogContent, setEditingLogContent] = useState('')
  const [activeRelationField, setActiveRelationField] = useState<number | null>(null)
  const [relationSearch, setRelationSearch] = useState('')
  const [relationRows, setRelationRows] = useState<TableRow[]>([])
  const [relationLoading, setRelationLoading] = useState(false)
  const [uploadingField, setUploadingField] = useState<number | null>(null)
  const [modalUsers, setModalUsers] = useState<CollaboratorUser[]>([])

  const parseNumberArray = (value: CellValue): number[] => {
    if (Array.isArray(value)) {
      return value.flatMap(item => {
        if (item == null) return []
        if (typeof item === 'number' && !isNaN(item)) return [item]
        if (typeof item === 'string') {
          const parsed = Number(item)
          return Number.isNaN(parsed) ? [] : [parsed]
        }
        if (typeof item === 'object' && item !== null && 'id' in item && typeof (item as any).id === 'number') {
          return [(item as any).id]
        }
        return []
      })
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parseNumberArray(parsed as CellValue[])
      } catch {
        // fallback below
      }
      return value
        .split(/[,;\s]+/)
        .map(Number)
        .filter(n => !Number.isNaN(n))
    }

    if (typeof value === 'object' && value !== null && 'id' in value && typeof (value as any).id === 'number') {
      return [(value as any).id]
    }

    return []
  }

  const parseSelectValues = (val: any): string[] => {
    if (val === null || val === undefined || val === '') return []
    if (Array.isArray(val)) {
      return val.map(item => typeof item === 'object' ? (item.value || item.name || item.id || String(item)) : String(item)).filter(Boolean)
    }
    if (typeof val === 'object') {
      if (Array.isArray(val.choices)) return val.choices.map(String).filter(Boolean)
      if (val.value || val.name || val.id) return [String(val.value || val.name || val.id)]
      return [String(val)]
    }
    if (typeof val === 'string') {
      const trimmed = val.trim()
      if (!trimmed) return []
      try {
        let parsed = JSON.parse(trimmed)
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed) } catch {}
        }
        return parseSelectValues(parsed)
      } catch {
        return trimmed.split(',').map(s => s.trim()).filter(Boolean)
      }
    }
    return [String(val)]
  }

  const cleanChoice = (item: any): string[] => {
    if (item === null || item === undefined || item === '') return []
    if (typeof item === 'object') {
      if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice)
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

  const getFieldOptionsList = (optionsRaw: any): string[] => {
    if (!optionsRaw) return []
    let rawItems: any[] = []
    try {
      let parsed = typeof optionsRaw === 'string' ? JSON.parse(optionsRaw) : optionsRaw
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed) } catch {}
      }
      if (Array.isArray(parsed)) rawItems = parsed
      else if (parsed && Array.isArray(parsed.choices)) rawItems = parsed.choices
      else if (parsed && Array.isArray(parsed.select_options)) rawItems = parsed.select_options
    } catch {
      // Ignore
    }
    if (rawItems.length === 0 && typeof optionsRaw === 'string') {
      rawItems = optionsRaw.split(',')
    }
    const cleaned = rawItems.flatMap(cleanChoice)
    return Array.from(new Set(cleaned))
  }

  const parseStringArray = (value: CellValue): string[] => {
    return parseSelectValues(value)
  }

  const parseActivityLog = (value: CellValue): ActivityLogEntry[] => {
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return {
            id: typeof (item as any).id === 'string' ? (item as any).id : String((item as any).id || Date.now()),
            content: String((item as any).content || ''),
            user: String((item as any).user || '系統'),
            time: String((item as any).time || new Date().toISOString()),
          }
        }
        return {
          id: String(Date.now()),
          content: String(item),
          user: '系統',
          time: new Date().toISOString(),
        }
      })
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return parseActivityLog(parsed as CellValue[])
      } catch {
        return [{ id: String(Date.now()), content: value, user: '系統', time: new Date().toISOString() }]
      }
    }

    return []
  }

  const parseAttachmentFiles = (value: CellValue): AttachmentFile[] => {
    if (Array.isArray(value)) {
      return value.filter(item => typeof item === 'object' && item !== null && typeof (item as any).url === 'string') as AttachmentFile[]
    }

    return []
  }

  const getStringValue = (value: CellValue): string => {
    if (value == null) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value)
  }

  const isAttachmentFile = (value: CellValue): value is AttachmentFile => {
    return typeof value === 'object' && value !== null && typeof (value as any).url === 'string'
  }

  const maybeNumberValue = (value: CellValue): string => {
    return typeof value === 'number' ? String(value) : ''
  }

  const maybeDateValue = (value: CellValue): string => {
    return typeof value === 'string' ? value : ''
  }

  const handlePasteImage = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items || !row) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const base64Url = event.target?.result as string
            if (base64Url) {
              const fileField = fields.find(f => f.type === 'file' || f.type === 'attachment')
              if (fileField) {
                const fieldKey = `field_${fileField.id}`
                const currentFiles = parseAttachmentFiles(localData[fieldKey])
                const newFiles = [...currentFiles, { name: `pasted_image_${Date.now()}.png`, url: base64Url }]
                onUpdateCell(row.id, fieldKey, newFiles as any)
                setLocalData(prev => ({ ...prev, [fieldKey]: newFiles as any }))
              }
            }
          }
          reader.readAsDataURL(blob)
        }
      }
    }
  }, [fields, localData, onUpdateCell, row])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          setModalUsers(data)
        }
      } catch (e) {}
    }
    fetchUsers()
  }, [isOpen])

  const toggleCollaboratorUser = (fieldKey: string, userId: number) => {
    if (!row) return
    const currentVal = localData[fieldKey]
    const currentIds = parseNumberArray(currentVal)

    const nextIds = currentIds.includes(userId)
      ? currentIds.filter(id => id !== userId)
      : [...currentIds, userId]

    onUpdateCell(row.id, fieldKey, nextIds)

    const updatedLocal = nextIds.map(id => {
      const u = modalUsers.find(user => user.id === id)
      return { id, username: u?.username ?? `用戶 ID: ${id}` } as { id: number; username: string }
    })
    handleInputChange(fieldKey, updatedLocal)
  }

  // Comments state
  const [comments, setComments] = useState<RowComment[]>([])
  const [commentInput, setCommentInput] = useState('')
  const [commentsLoading, setCommentsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of comments timeline on load
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // =============================================
  // Load & Post Comments
  // =============================================
  const loadComments = useCallback(async (targetRow: TableRow) => {
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/tables/${targetRow.tableId}/rows/comments?rowId=${targetRow.id}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data)
      }
    } catch {
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!row) return
    const timer = window.setTimeout(() => {
      void loadComments(row)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [row, loadComments])

  if (!isOpen || !row) return null

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentInput.trim()) return

    try {
      const res = await fetch(`/api/tables/${row.tableId}/rows/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId: row.id, content: commentInput.trim() })
      })
      if (res.ok) {
        setCommentInput('')
        void loadComments(row)
      } else {
        const data = await res.json()
        alert(data.error || '留言失敗')
      }
    } catch {
      alert('留言發送失敗')
    }
  }

  // =============================================
  // Field Value Handlers
  // =============================================
  const handleInputChange = (fieldKey: string, value: CellValue) => {
    setLocalData(prev => ({ ...prev, [fieldKey]: value }))
  }

  const handleBlur = (fieldKey: string, originalValue: CellValue) => {
    const currentValue = localData[fieldKey]
    if (currentValue !== originalValue) {
      onUpdateCell(row.id, fieldKey, currentValue)
    }
  }

  const handleCheckboxChange = (fieldKey: string, checked: boolean) => {
    handleInputChange(fieldKey, checked)
    onUpdateCell(row.id, fieldKey, checked)
  }

  // Multiple select choices toggle
  const toggleMultiSelectOption = (fieldKey: string, option: string) => {
    const currentVal = localData[fieldKey]
    const newList = parseStringArray(currentVal)

    const updatedList = newList.includes(option)
      ? newList.filter(o => o !== option)
      : [...newList, option]

    handleInputChange(fieldKey, updatedList)
    onUpdateCell(row.id, fieldKey, updatedList)
  }

  const loadRelationRows = async (targetTableId: number) => {
    setRelationLoading(true)
    try {
      const res = await fetch(`/api/tables/${targetTableId}/rows`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setRelationRows(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setRelationLoading(false)
    }
  }

  const toggleRelationModal = (fieldId: number, targetTableId: number) => {
    if (activeRelationField === fieldId) {
      setActiveRelationField(null)
    } else {
      setActiveRelationField(fieldId)
      setRelationSearch('')
      loadRelationRows(targetTableId)
    }
  }

  const toggleLinkRow = (fieldKey: string, targetRowId: number) => {
    const currentList = parseNumberArray(localData[fieldKey])
    const newList = currentList.includes(targetRowId)
      ? currentList.filter(id => id !== targetRowId)
      : [...currentList, targetRowId]

    handleInputChange(fieldKey, newList)
    onUpdateCell(row.id, fieldKey, newList)
  }

  // File Upload Handlers
  const handleUploadClick = (fieldId: number) => {
    setUploadingField(fieldId)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldId: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    const key = `field_${fieldId}`
    const currentFiles = parseAttachmentFiles(localData[key])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error()
      const uploadedFile = await res.json()

      const newList = [...currentFiles, uploadedFile]
      handleInputChange(key, newList)
      await onUpdateCell(row.id, key, newList)
    } catch {
      alert('檔案上傳失敗')
    } finally {
      setUploadingField(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeFile = (fieldKey: string, fileUrl: string) => {
    const currentFiles = parseAttachmentFiles(localData[fieldKey])
    const newList = currentFiles.filter(f => f.url !== fileUrl)
    handleInputChange(fieldKey, newList)
    onUpdateCell(row.id, fieldKey, newList)
  }

  // Helper to color tags dynamically
  const getTagStyle = (idx: number) => {
    const colors = [
      { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#60a5fa' },
      { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399' },
      { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24' },
      { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171' },
      { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.4)', text: '#a78bfa' },
      { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.4)', text: '#f472b6' }
    ]
    return colors[idx % colors.length]
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onPaste={handlePasteImage}
        style={{
          width: '90%',
          maxWidth: '920px',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>列 #{row.order} 詳細資料</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {row.id} · 建立時間: {new Date(row.createdAt).toLocaleString()}</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '4px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        {/* Double-column Content Panel */}
        <div style={{ display: 'flex', gap: '28px', flex: 1, minHeight: 0 }}>
          
          {/* LEFT COLUMN: Field Editors (60%) */}
          <div style={{ flex: '0 0 58%', overflowY: 'auto', paddingRight: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {fields.map(field => {
              const key = `field_${field.id}`
              const val = localData[key]
              const options = field.options ? JSON.parse(field.options) : {}

              // Computed fields helper
              const isReadOnly = ['lookup', 'rollup', 'formula', 'created_on', 'last_modified_on', 'created_by', 'last_modified_by', 'autonumber'].includes(field.type)

              return (
                <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {field.name}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '3px' }}>
                      {field.type}
                    </span>
                  </div>

                  {/* READ ONLY / AUDIT FIELDS */}
                  {isReadOnly ? (
                    <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '6px', color: 'var(--accent-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                      {val == null || val === '' ? '—' : String(val)}
                    </div>
                  ) : (
                    <>
                      {/* TEXT / EMAIL / URL / PHONE */}
                      {(field.type === 'text' || field.type === 'email' || field.type === 'url' || field.type === 'phone') && (
                        <input
                          type="text"
                          value={val == null ? '' : String(val)}
                          onChange={e => handleInputChange(key, e.target.value)}
                          onBlur={() => handleBlur(key, row.data[key])}
                        />
                      )}

                      {/* LONG TEXT */}
                      {field.type === 'long_text' && (
                        <textarea
                          rows={3}
                          value={val == null ? '' : String(val)}
                          onChange={e => handleInputChange(key, e.target.value)}
                          onBlur={() => handleBlur(key, row.data[key])}
                          style={{ resize: 'vertical' }}
                        />
                      )}

                      {/* NUMBER */}
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={val == null ? '' : String(val)}
                          onChange={e => handleInputChange(key, e.target.value === '' ? null : Number(e.target.value))}
                          onBlur={() => handleBlur(key, row.data[key])}
                        />
                      )}

                      {/* DATE */}
                      {field.type === 'date' && (
                        <input
                          type="date"
                          value={val == null ? '' : String(val)}
                          onChange={e => handleInputChange(key, e.target.value)}
                          onBlur={() => handleBlur(key, row.data[key])}
                        />
                      )}

                      {/* BOOLEAN */}
                      {field.type === 'boolean' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                          <input
                            type="checkbox"
                            className="cell-checkbox"
                            checked={Boolean(val)}
                            onChange={e => handleCheckboxChange(key, e.target.checked)}
                            id={`detail_chk_${field.id}`}
                          />
                          <label htmlFor={`detail_chk_${field.id}`} style={{ margin: 0, cursor: 'pointer', userSelect: 'none', fontSize: '13px' }}>
                            {Boolean(val) ? '是 (True)' : '否 (False)'}
                          </label>
                        </div>
                      )}

                      {/* SINGLE SELECT */}
                      {field.type === 'single_select' && (
                        <select
                          value={parseSelectValues(val)[0] || ''}
                          onChange={e => {
                            const newChoice = e.target.value
                            handleInputChange(key, newChoice)
                            onUpdateCell(row.id, key, newChoice)
                          }}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none' }}
                        >
                          <option value="">（未選擇）</option>
                          {getFieldOptionsList(field.options).map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}

                      {/* ACTIVITY LOG (CONVERSATION HISTORY) */}
                      {field.type === 'activity_log' && (
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', background: 'rgba(0,0,0,0.1)' }}>
                          {/* Timeline List */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                            {(() => {
                              let logEntries: ActivityLogEntry[] = []
                              try {
                                logEntries = Array.isArray(val) ? val : (typeof val === 'string' && val ? JSON.parse(val) : [])
                                if (!Array.isArray(logEntries)) logEntries = []
                              } catch {
                                logEntries = val ? [{ id: '1', content: String(val), user: '系統', time: new Date().toISOString() }] : []
                              }
                              
                              if (logEntries.length === 0) {
                                return <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>尚無日誌記錄。</span>
                              }

                              return logEntries.map((entry, idx) => {
                                const isEditingThis = editingLogId === `${field.id}_${entry.id}`
                                return (
                                  <div key={entry.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '6px 8px', borderRadius: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{entry.user}</span>
                                      <span>{entry.time ? new Date(entry.time).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                    </div>
                                    
                                    {isEditingThis ? (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        <input
                                          type="text"
                                          value={editingLogContent}
                                          onChange={e => setEditingLogContent(e.target.value)}
                                          style={{ flex: 1, padding: '4px 6px', fontSize: '11px' }}
                                        />
                                        <button
                                          onClick={() => {
                                            const updated = logEntries.map(e => e.id === entry.id ? { ...e, content: editingLogContent, time: new Date().toISOString() } : e)
                                            handleInputChange(key, JSON.stringify(updated))
                                            onUpdateCell(row.id, key, JSON.stringify(updated))
                                            setEditingLogId(null)
                                          }}
                                          style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--success)', border: 'none', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                          儲存
                                        </button>
                                        <button
                                          onClick={() => setEditingLogId(null)}
                                          style={{ padding: '2px 8px', fontSize: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                          取消
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{entry.content}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                          <button
                                            onClick={() => {
                                              setEditingLogId(`${field.id}_${entry.id}`)
                                              setEditingLogContent(entry.content ?? '')
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-secondary)', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                                          >
                                            編輯
                                          </button>
                                          <button
                                            onClick={() => {
                                              const filtered = logEntries.filter(e => e.id !== entry.id)
                                              handleInputChange(key, JSON.stringify(filtered))
                                              onUpdateCell(row.id, key, JSON.stringify(filtered))
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                                          >
                                            刪除
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            })()}
                          </div>

                          {/* Add log entry form */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              placeholder="輸入新歷程/對話內容..."
                              id={`new_log_input_${field.id}`}
                              style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const target = e.currentTarget
                                  const valStr = target.value.trim()
                                  if (!valStr) return
                                  
                                  let logEntries: ActivityLogEntry[] = []
                                  try {
                                    logEntries = Array.isArray(val) ? val : (typeof val === 'string' && val ? JSON.parse(val) : [])
                                    if (!Array.isArray(logEntries)) logEntries = []
                                  } catch {
                                    logEntries = val ? [{ id: '1', content: String(val), user: '系統', time: new Date().toISOString() }] : []
                                  }
                                  
                                  const newEntry = {
                                    id: String(Date.now()),
                                    content: valStr,
                                    user: currentUser?.username || '使用者',
                                    time: new Date().toISOString()
                                  }
                                  const updated = [...logEntries, newEntry]
                                  handleInputChange(key, JSON.stringify(updated))
                                  onUpdateCell(row.id, key, JSON.stringify(updated))
                                  target.value = ''
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const inputEl = document.getElementById(`new_log_input_${field.id}`) as HTMLInputElement
                                const valStr = inputEl?.value.trim()
                                if (!valStr) return
                                
                                let logEntries: ActivityLogEntry[] = []
                                try {
                                  logEntries = Array.isArray(val) ? val : (typeof val === 'string' && val ? JSON.parse(val) : [])
                                  if (!Array.isArray(logEntries)) logEntries = []
                                } catch {
                                  logEntries = val ? [{ id: '1', content: String(val), user: '系統', time: new Date().toISOString() }] : []
                                }
                                
                                const newEntry = {
                                  id: String(Date.now()),
                                  content: valStr,
                                  user: currentUser?.username || '使用者',
                                  time: new Date().toISOString()
                                }
                                const updated = [...logEntries, newEntry]
                                handleInputChange(key, JSON.stringify(updated))
                                onUpdateCell(row.id, key, JSON.stringify(updated))
                                if (inputEl) inputEl.value = ''
                              }}
                              style={{ padding: '6px 12px', background: 'var(--accent-gradient)', border: 'none', color: 'white', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              新增
                            </button>
                          </div>
                        </div>
                      )}

                      {/* COLLABORATORS CHECKLIST */}
                      {field.type === 'collaborator' && (
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', background: 'rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>選擇指派協作者：</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                            {modalUsers.map(user => {
                              const list = parseNumberArray(val)
                              const isSelected = list.includes(user.id)
                              return (
                                <label
                                  key={user.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                    padding: '4px 10px',
                                    borderRadius: '16px',
                                    userSelect: 'none',
                                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleCollaboratorUser(key, user.id)}
                                    style={{ display: 'none' }}
                                  />
                                  <span>{user.username}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* MULTIPLE SELECT TAGS */}
                      {field.type === 'multiple_select' && (
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {getFieldOptionsList(field.options).map((choice: string, choiceIdx: number) => {
                              const selectedList = parseSelectValues(val)
                              const isSelected = selectedList.includes(choice)
                              const tagColor = getTagStyle(choiceIdx)

                              return (
                                <span
                                  key={choice}
                                  onClick={() => {
                                    const updatedList = isSelected
                                      ? selectedList.filter(o => o !== choice)
                                      : [...selectedList, choice]
                                    const jsonVal = JSON.stringify(updatedList)
                                    handleInputChange(key, jsonVal)
                                    onUpdateCell(row.id, key, jsonVal)
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    userSelect: 'none',
                                    background: isSelected ? tagColor.bg : 'rgba(255,255,255,0.02)',
                                    border: `1px solid ${isSelected ? tagColor.border : 'var(--border-color)'}`,
                                    color: isSelected ? tagColor.text : 'var(--text-muted)',
                                    transition: 'all 0.1s'
                                  }}
                                >
                                  {choice}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* FILE ATTACHMENTS */}
                      {field.type === 'file' && (
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                            {parseAttachmentFiles(val).map((file, idx) => {
                              const isImg = /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(file.url || '')
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    position: 'relative',
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--border-color)'
                                  }}
                                >
                                  {isImg ? (
                                    <img src={file.url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>
                                      FILE
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      background: 'rgba(0,0,0,0.7)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                      opacity: 0,
                                      transition: 'opacity 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                                  >
                                    <a href={file.url} download={file.name} title="下載">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="3" y2="15"/>
                                      </svg>
                                    </a>
                                    <button onClick={() => file.url && removeFile(key, file.url)} style={{ padding: 0 }} title="刪除">
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5">
                                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                            {parseAttachmentFiles(val).length === 0 && (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>無附件</span>
                            )}
                          </div>
                          <button
                            className="toolbar-btn"
                            onClick={() => handleUploadClick(field.id)}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            disabled={uploadingField === field.id}
                          >
                            {uploadingField === field.id ? '上傳中...' : '上傳檔案...'}
                          </button>
                        </div>
                      )}

                      {/* LINK ROW (RELATION) */}
                      {field.type === 'link_row' && (
                        <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', background: 'rgba(0,0,0,0.1)' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                            {Array.isArray(val) ? val.map((item, idx) => {
                              const targetId = typeof item === 'object' && item !== null && 'id' in item && typeof (item as any).id === 'number'
                                ? (item as any).id
                                : typeof item === 'number'
                                  ? item
                                  : undefined
                              if (typeof targetId !== 'number') return null

                              const label = typeof item === 'object' && item !== null
                                ? (typeof (item as any).value === 'string' ? (item as any).value : `ID: ${targetId}`)
                                : `列 ID: ${item}`

                              return (
                                <span
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    color: 'var(--accent-secondary)'
                                  }}
                                >
                                  {label}
                                  <button onClick={() => toggleLinkRow(key, targetId)} style={{ color: 'var(--danger)', display: 'flex', padding: 0 }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                                    </svg>
                                  </button>
                                </span>
                              )
                            }) : null}
                            {(!Array.isArray(val) || val.length === 0) && (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>無關聯</span>
                            )}
                          </div>

                          <button
                            className="toolbar-btn"
                            onClick={() => toggleRelationModal(field.id, options.targetTableId)}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            選取連結表...
                          </button>

                          {activeRelationField === field.id && (
                            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                              <input
                                type="text"
                                placeholder="搜尋列內容..."
                                value={relationSearch}
                                onChange={e => setRelationSearch(e.target.value)}
                                style={{ marginBottom: '8px', padding: '4px 8px', fontSize: '12px' }}
                              />
                              {relationLoading ? (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>載入中...</div>
                              ) : (
                                <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {relationRows
                                    .filter(r => {
                                      const mainFieldKey = Object.keys(r.data)[0]
                                      const mainVal = String(r.data[mainFieldKey] || '')
                                      return mainVal.toLowerCase().includes(relationSearch.toLowerCase())
                                    })
                                    .map(r => {
                                      const mainFieldKey = Object.keys(r.data)[0]
                                      const mainVal = String(r.data[mainFieldKey] || `列 ID: ${r.id}`)
                                      const normalizedList = parseNumberArray(val)
                                      const isLinked = normalizedList.includes(r.id)
                                      return (
                                        <div
                                          key={r.id}
                                          onClick={() => toggleLinkRow(key, r.id)}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            background: isLinked ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                            fontSize: '12px'
                                          }}
                                        >
                                          <span>{mainVal}</span>
                                          {isLinked ? (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3">
                                              <path d="M20 6 9 17l-5-5"/>
                                            </svg>
                                          ) : (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                                              <path d="M5 12h14"/><path d="M12 5v14"/>
                                            </svg>
                                          )}
                                        </div>
                                      )
                                    })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Vertical Divider */}
          <div style={{ width: '1px', background: 'var(--border-color)', height: '100%', flexShrink: 0 }} />

          {/* RIGHT COLUMN: Collaboration Chat Room (40%) */}
          <div style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              留言協作討論區
            </h4>

            {/* Comments Timeline Grid */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
              {commentsLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>載入討論中...</div>
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px', fontStyle: 'italic' }}>尚無協作留言。在下方輸入內容開啟討論！</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{c.user.username} <span style={{ fontSize: '9px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({c.user.role === 'admin' ? '管理' : '成員'})</span></span>
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all', lineHeight: 1.4 }}>{c.content}</p>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comments input box */}
            <form onSubmit={postComment} style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <input
                type="text"
                placeholder="輸入您的協作留言..."
                value={commentInput}
                onChange={e => setCommentInput(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
              />
              <button
                type="submit"
                style={{ padding: '8px 14px', background: 'var(--accent-gradient)', border: 'none', color: 'white', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
              >
                傳送
              </button>
            </form>
          </div>
        </div>

        {/* Hidden inputs for uploading files */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={e => uploadingField && handleFileChange(e, uploadingField)}
        />

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', flexShrink: 0 }}>
          <button className="confirm-btn" onClick={onClose}>完成關閉</button>
        </div>
      </div>
    </div>
  )
}
