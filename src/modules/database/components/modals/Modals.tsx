'use client'

import React, { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { 
  LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput,
  Type, AlignLeft, Plug, Hash, Star, CheckCircle2, Edit3, User,
  Plus, UserCheck, Link2, Mail, FileText, CheckCircle, List, Phone,
  Calculator, Grid, Box, Glasses, Users, Tag, Binary, Lock, FileEdit,
  Sparkles, Search, ChevronDown, X
} from 'lucide-react'
import { TableField } from '@/modules/database/types'

// ============================================
// Workspace Modal
// ============================================

interface WorkspaceModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function WorkspaceModal({ show, onClose, onSubmit }: WorkspaceModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      await onSubmit(name.trim())
      setName('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="新增工作區" size="small">
      <form onSubmit={handleSubmit}>
        <div className="control">
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>工作區名稱</label>
          <div className="control__elements">
            <div className="form-input form-input--large">
              <div className="form-input__wrapper">
                <input
                  type="text"
                  className="form-input__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入工作區名稱"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '建立中...' : '建立'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================
// Database Modal
// ============================================

interface DatabaseModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function DatabaseModal({ show, onClose, onSubmit }: DatabaseModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      await onSubmit(name.trim())
      setName('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="新增資料庫" size="small">
      <form onSubmit={handleSubmit}>
        <div className="control">
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>資料庫名稱</label>
          <div className="control__elements">
            <div className="form-input form-input--large">
              <div className="form-input__wrapper">
                <input
                  type="text"
                  className="form-input__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入資料庫名稱"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '建立中...' : '建立'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================
// Rename Modal
// ============================================

interface RenameModalProps {
  show: boolean
  type: 'workspace' | 'database' | 'table' | null
  initialValue: string
  onClose: () => void
  onSubmit: (newName: string) => Promise<void>
}

export function RenameModal({ show, type, initialValue, onClose, onSubmit }: RenameModalProps) {
  const [name, setName] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(initialValue)
  }, [initialValue, show])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      await onSubmit(name.trim())
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'workspace': return '重新命名工作區'
      case 'database': return '重新命名資料庫'
      case 'table': return '重新命名資料表'
      default: return '重新命名'
    }
  }

  return (
    <Modal show={show} onClose={onClose} title={getTitle()} size="small">
      <form onSubmit={handleSubmit}>
        <div className="control">
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>新名稱</label>
          <div className="control__elements">
            <div className="form-input form-input--large">
              <div className="form-input__wrapper">
                <input
                  type="text"
                  className="form-input__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入新名稱"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '儲存中...' : '儲存'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================
// View Modal
// ============================================

interface ViewModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string, type: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form') => Promise<void>
}

export function ViewModal({ show, onClose, onSubmit }: ViewModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form'>('grid')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      await onSubmit(name.trim(), type)
      setName('')
      setType('grid')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="新增視圖" size="small">
      <form onSubmit={handleSubmit}>
        <div className="control" style={{ marginBottom: '16px' }}>
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>視圖名稱</label>
          <div className="control__elements">
            <div className="form-input form-input--large">
              <div className="form-input__wrapper">
                <input
                  type="text"
                  className="form-input__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入視圖名稱"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="control">
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>視圖類型</label>
          <div className="control__elements">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { id: 'grid', label: '表格 (Grid)', icon: LayoutGrid },
                { id: 'kanban', label: '看板 (Kanban)', icon: Kanban },
                { id: 'gallery', label: '畫廊 (Gallery)', icon: LayoutTemplate },
                { id: 'calendar', label: '日曆 (Calendar)', icon: Calendar },
                { id: 'timeline', label: '時間軸 (Timeline)', icon: Clock },
                { id: 'form', label: '表單 (Form)', icon: FormInput }
              ].map(v => {
                const isSelected = type === v.id;
                const Icon = v.icon;
                return (
                  <div
                    key={v.id}
                    onClick={() => setType(v.id as any)}
                    style={{
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      color: isSelected ? '#1e40af' : '#475569',
                      fontWeight: isSelected ? 600 : 500,
                      boxShadow: isSelected ? '0 1px 2px 0 rgba(37,99,235,0.1)' : '0 1px 2px 0 rgba(0,0,0,0.02)'
                    }}
                  >
                    <Icon size={18} style={{ color: isSelected ? '#2563eb' : '#64748b', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px' }}>{v.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '建立中...' : '建立'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================
// Field Modal
// ============================================

interface FieldModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string, type: string, options?: any) => Promise<void>
  tables?: Array<{ id: number; name: string }>
  fields?: any[]
  editField?: TableField | null
}

const getOptionColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return { bg: `hsl(${hue}, 80%, 93%)`, text: `hsl(${hue}, 80%, 30%)` }
}

export function FieldModal({ show, onClose, onSubmit, tables = [], fields = [], editField }: FieldModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const [name, setName] = useState('Single line text')
  const [nameError, setNameError] = useState(false)
  const [type, setType] = useState('text')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(true)
  const [typeSearch, setTypeSearch] = useState('')
  
  // Options state
  const [optionsList, setOptionsList] = useState<string[]>([])
  const [newOptionText, setNewOptionText] = useState('')
  const [targetTableId, setTargetTableId] = useState<number | null>(null)
  const [relationFieldId, setRelationFieldId] = useState<number | null>(null)
  const [targetFieldId, setTargetFieldId] = useState<number | null>(null)
  const [rollupFunction, setRollupFunction] = useState('sum')
  const [formula, setFormula] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) {
      if (editField) {
        setName(editField.name || '')
        setType(editField.type || 'text')
        setTypeDropdownOpen(false)
        let choices: string[] = []
        if (editField.options) {
          try {
            let parsed = typeof editField.options === 'string' ? JSON.parse(editField.options) : editField.options
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed) } catch {}
            }
            if (Array.isArray(parsed)) choices = parsed.map(String)
            else if (parsed && Array.isArray(parsed.choices)) choices = parsed.choices.map(String)
            else if (parsed && Array.isArray(parsed.select_options)) choices = parsed.select_options.map((o: any) => typeof o === 'object' ? o.value || o.name || String(o) : String(o))
          } catch {}
        }
        setOptionsList(choices)
      } else {
        setName('Single line text')
        setType('text')
        setTypeDropdownOpen(true)
        setTypeSearch('')
        setOptionsList([])
      }
    }
  }, [editField, show])

  const fieldTypeItems = [
    { key: 'text', label: 'Single line text', icon: <Type size={16} /> },
    { key: 'long_text', label: 'Long text', icon: <AlignLeft size={16} /> },
    { key: 'link_row', label: 'Link to table', icon: <Plug size={16} /> },
    { key: 'number', label: 'Number', icon: <Hash size={16} /> },
    { key: 'rating', label: 'Rating', icon: <Star size={16} /> },
    { key: 'boolean', label: 'Boolean', icon: <CheckCircle2 size={16} /> },
    { key: 'date', label: 'Date', icon: <Calendar size={16} /> },
    { key: 'last_modified_on', label: 'Last modified', icon: <Edit3 size={16} /> },
    { key: 'last_modified_by', label: 'Last modified by', icon: <User size={16} /> },
    { key: 'created_on', label: 'Created on', icon: <Plus size={16} /> },
    { key: 'created_by', label: 'Created by', icon: <UserCheck size={16} /> },
    { key: 'duration', label: 'Duration', icon: <Clock size={16} /> },
    { key: 'url', label: 'URL', icon: <Link2 size={16} /> },
    { key: 'email', label: 'Email', icon: <Mail size={16} /> },
    { key: 'single_select', label: 'Single select', icon: <CheckCircle size={16} /> },
    { key: 'multiple_select', label: 'Multiple select', icon: <List size={16} /> },
    { key: 'phone_number', label: 'Phone number', icon: <Phone size={16} /> },
    { key: 'formula', label: 'Formula', icon: <Calculator size={16} /> },
    { key: 'count', label: 'Count', icon: <Grid size={16} /> },
    { key: 'rollup', label: 'Rollup', icon: <Box size={16} /> },
    { key: 'lookup', label: 'Lookup', icon: <Glasses size={16} /> },
    { key: 'collaborators', label: 'Collaborators', icon: <Users size={16} /> },
    { key: 'uuid', label: 'UUID', icon: <Tag size={16} /> },
    { key: 'autonumber', label: 'Autonumber', icon: <Binary size={16} /> },
    { key: 'password', label: 'Password', icon: <Lock size={16} /> },
    { key: 'edit_row_link', label: 'Edit row link', icon: <FileEdit size={16} /> },
    { key: 'ai_prompt', label: 'AI prompt', icon: <Sparkles size={16} /> }
  ]

  const filteredTypes = fieldTypeItems.filter(ft =>
    ft.label.toLowerCase().includes(typeSearch.toLowerCase()) ||
    ft.key.toLowerCase().includes(typeSearch.toLowerCase())
  )

  const selectedTypeObj = fieldTypeItems.find(ft => ft.key === type) || fieldTypeItems[0]

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) {
      setNameError(true)
      return
    }
    
    setLoading(true)
    try {
      let parsedOptions: any = null
      if (type === 'single_select' || type === 'multiple_select') {
        parsedOptions = { choices: optionsList }
      } else if (type === 'link_row' && targetTableId) {
        parsedOptions = { targetTableId }
      } else if ((type === 'lookup' || type === 'rollup') && relationFieldId) {
        parsedOptions = {
          relationFieldId,
          targetFieldId,
          ...(type === 'rollup' && { rollupFunction })
        }
      } else if (type === 'formula') {
        parsedOptions = { formula }
      }

      await onSubmit(name.trim(), type, parsedOptions)
      setName('')
      setNameError(false)
      setType('text')
      setOptionsList([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="" size="small" overflowVisible={true}>
      <form onSubmit={handleSubmit}>
        {/* Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'basic' ? 600 : 400,
              color: activeTab === 'basic' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'basic' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Basic
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advanced')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontWeight: activeTab === 'advanced' ? 600 : 400,
              color: activeTab === 'advanced' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'advanced' ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Advanced
          </button>
        </div>

        {activeTab === 'basic' ? (
          <div>
            {/* Name Input */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError(false)
                }}
                placeholder="Name"
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: nameError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {nameError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                  請輸入欄位名稱 (Field name is required)
                </div>
              )}
            </div>

            {/* Type Selector */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <div
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: '#ffffff',
                  fontSize: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                    {selectedTypeObj.icon}
                  </span>
                  <span>{selectedTypeObj.label}</span>
                </div>
                <ChevronDown size={16} style={{ color: '#64748b' }} />
              </div>

              {/* Type Dropdown Menu */}
              {typeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: '100%',
                    maxHeight: '300px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                    <Search size={16} style={{ color: '#94a3b8', marginRight: '8px' }} />
                    <input
                      type="text"
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      placeholder="Search"
                      autoFocus
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        fontSize: '13px',
                        background: 'transparent'
                      }}
                    />
                  </div>

                  <div style={{ overflowY: 'auto', padding: '4px', flex: 1 }}>
                    {filteredTypes.map((ft) => (
                      <div
                        key={ft.key}
                        onClick={() => {
                          setType(ft.key)
                          setName(ft.label)
                          setTypeDropdownOpen(false)
                          setTypeSearch('')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          background: type === ft.key ? '#f1f5f9' : 'transparent',
                          fontWeight: type === ft.key ? 500 : 400,
                          color: '#334155'
                        }}
                        onMouseEnter={(e) => {
                          if (type !== ft.key) e.currentTarget.style.background = '#f8fafc'
                        }}
                        onMouseLeave={(e) => {
                          if (type !== ft.key) e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>
                          {ft.icon}
                        </span>
                        <span>{ft.label}</span>
                      </div>
                    ))}
                    {filteredTypes.length === 0 && (
                      <div style={{ padding: '12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                        No results found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Type Specific Options */}
            {(type === 'single_select' || type === 'multiple_select') && (
              <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'block' }}>
                  Choices / Options
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  {optionsList.map((opt, i) => {
                    const { bg, text } = getOptionColor(opt)
                    return (
                      <span key={i} style={{ background: bg, color: text, padding: '3px 10px', borderRadius: '9999px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {opt}
                        <X
                          size={12}
                          style={{ cursor: 'pointer', opacity: 0.7 }}
                          onClick={() => setOptionsList(optionsList.filter((_, index) => index !== i))}
                        />
                      </span>
                    )
                  })}
                  {optionsList.length === 0 && (
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No choices yet. Add options below.</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newOptionText}
                    onChange={(e) => setNewOptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (newOptionText.trim()) {
                          setOptionsList([...optionsList, newOptionText.trim()])
                          setNewOptionText('')
                        }
                      }
                    }}
                    placeholder="Enter new choice & press Enter"
                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newOptionText.trim()) {
                        setOptionsList([...optionsList, newOptionText.trim()])
                        setNewOptionText('')
                      }
                    }}
                    style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {type === 'link_row' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Target Table
                </label>
                <select
                  value={targetTableId || ''}
                  onChange={(e) => setTargetTableId(Number(e.target.value) || null)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                >
                  <option value="">Select a table...</option>
                  {tables?.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {(type === 'lookup' || type === 'rollup') && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    Relation Field
                  </label>
                  <select
                    value={relationFieldId || ''}
                    onChange={(e) => setRelationFieldId(Number(e.target.value) || null)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  >
                    <option value="">Select relation field...</option>
                    {fields?.filter(f => f.type === 'link_row').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                {type === 'rollup' && (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                      Rollup Function
                    </label>
                    <select
                      value={rollupFunction}
                      onChange={(e) => setRollupFunction(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                    >
                      <option value="sum">Sum</option>
                      <option value="avg">Avg</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                      <option value="count">Count</option>
                      <option value="concat">Concat</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {type === 'formula' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Formula
                </label>
                <input
                  type="text"
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g. field_1 + field_2"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '4px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                Description / Help text
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description or guidance for this field..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            Cancel
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================
// Table Modal
// ============================================

interface TableModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function TableModal({ show, onClose, onSubmit }: TableModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    
    setLoading(true)
    try {
      await onSubmit(name.trim())
      setName('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="新增資料表" size="small">
      <form onSubmit={handleSubmit}>
        <div className="control">
          <label className="control__label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>資料表名稱</label>
          <div className="control__elements">
            <div className="form-input form-input--large">
              <div className="form-input__wrapper">
                <input
                  type="text"
                  className="form-input__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="輸入資料表名稱"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            取消
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '建立中...' : '建立'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

