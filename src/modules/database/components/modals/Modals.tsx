'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { 
  LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput,
  Type, AlignLeft, Plug, Hash, Star, CheckCircle2, Edit3, User,
  Plus, UserCheck, Link2, Mail, FileText, CheckCircle, List, Phone,
  Calculator, Grid, Box, Glasses, Users, Tag, Binary, Lock, FileEdit,
  Sparkles, Search, ChevronDown, X, Database, Table, UploadCloud, MessageSquare
} from 'lucide-react'
import { TableField } from '@/modules/database/types'
import { parseFormula, getSupportedFunctions } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'

// ============================================
// Workspace Modal
// ============================================

interface WorkspaceModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function WorkspaceModal({ show, onClose, onSubmit }: WorkspaceModalProps) {
  const { t } = useI18n()
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
    <Modal show={show} onClose={onClose} title={t('nav.createWorkspace')} size="small">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            工作區名稱
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#94a3b8', zIndex: 2 }}>
              <LayoutGrid size={16} />
            </div>
            <input
              type="text"
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                fontSize: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：行銷專案庫、團隊知識庫..."
              autoFocus
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            按 <kbd style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵ Enter</kbd> 送出
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Button type="secondary" size="regular" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" size="regular" onClick={handleSubmit} loading={loading}>
              {loading ? t('common.loading') : t('common.confirm')}
            </Button>
          </div>
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
  onOpenAirtableImport?: () => void
}

export function DatabaseModal({ show, onClose, onSubmit, onOpenAirtableImport }: DatabaseModalProps) {
  const { t } = useI18n()
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
    <Modal show={show} onClose={onClose} title={t('nav.createDatabase')} size="small">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            資料庫名稱
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#94a3b8', zIndex: 2 }}>
              <Database size={16} />
            </div>
            <input
              type="text"
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                fontSize: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：客戶資料、產品目錄..."
              autoFocus
            />
          </div>
        </div>

        {onOpenAirtableImport && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>或匯入現有外部資料庫：</span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenAirtableImport()
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                border: '1px dashed #EA580C',
                backgroundColor: '#FFF7ED',
                color: '#EA580C',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FFEDD5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFF7ED'}
            >
              <UploadCloud size={16} color="#EA580C" />
              <span>從 Airtable 匯入資料庫</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            按 <kbd style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵ Enter</kbd> 送出
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Button type="secondary" size="regular" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" size="regular" onClick={handleSubmit} loading={loading}>
              {loading ? t('common.loading') : t('common.confirm')}
            </Button>
          </div>
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            新名稱
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#94a3b8', zIndex: 2 }}>
              <Edit3 size={16} />
            </div>
            <input
              type="text"
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                fontSize: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="請輸入新名稱..."
              autoFocus
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            按 <kbd style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵ Enter</kbd> 儲存
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Button type="secondary" size="regular" onClick={onClose}>
              取消
            </Button>
            <Button type="primary" size="regular" onClick={handleSubmit} loading={loading}>
              {loading ? '儲存中...' : '儲存'}
            </Button>
          </div>
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

const DEFAULT_VIEW_NAMES: Record<string, string> = {
  grid: '表格視圖',
  kanban: '看板視圖',
  gallery: '畫廊視圖',
  calendar: '日曆視圖',
  timeline: '時間軸視圖',
  form: '表單視圖'
}

export function ViewModal({ show, onClose, onSubmit }: ViewModalProps) {
  const [type, setType] = useState<'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form'>('grid')
  const [name, setName] = useState<string>('表格視圖')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) {
      setType('grid')
      setName('表格視圖')
    }
  }, [show])

  const handleSelectType = (selectedType: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'form') => {
    // Auto-update name if empty or still matching a default type name
    if (!name || Object.values(DEFAULT_VIEW_NAMES).includes(name)) {
      setName(DEFAULT_VIEW_NAMES[selectedType] || '新視圖')
    }
    setType(selectedType)
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const finalName = name.trim() || DEFAULT_VIEW_NAMES[type] || '新視圖'
    
    setLoading(true)
    try {
      await onSubmit(finalName, type)
      setName('表格視圖')
      setType('grid')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const renderCurrentIcon = () => {
    switch (type) {
      case 'kanban': return <Kanban size={16} />
      case 'gallery': return <LayoutTemplate size={16} />
      case 'calendar': return <Calendar size={16} />
      case 'timeline': return <Clock size={16} />
      case 'form': return <FormInput size={16} />
      default: return <LayoutGrid size={16} />
    }
  }

  return (
    <Modal show={show} onClose={onClose} title="新增視圖" size="medium">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            視圖名稱
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#94a3b8', zIndex: 2 }}>
              {renderCurrentIcon()}
            </div>
            <input
              type="text"
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                fontSize: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：總覽視圖、進行中看板..."
              autoFocus
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            視圖類型
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
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
                <button
                  type="button"
                  key={v.id}
                  onClick={() => handleSelectType(v.id as any)}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    width: '100%',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    textAlign: 'left',
                    border: isSelected ? '1.5px solid #3F6212' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#F4F4F5' : '#f8fafc',
                    color: isSelected ? '#2d470d' : '#334155',
                    fontWeight: isSelected ? 600 : 500,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={16} style={{ color: isSelected ? '#3F6212' : '#94a3b8', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            按 <kbd style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵ Enter</kbd> 建立
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Button type="secondary" size="regular" onClick={onClose}>
              取消
            </Button>
            <Button type="primary" size="regular" onClick={handleSubmit} loading={loading}>
              {loading ? '建立中...' : '建立'}
            </Button>
          </div>
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
  tables?: Array<{ id: number; name: string; fields?: any[] }>
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
  const [formulaTab, setFormulaTab] = useState<'fields' | 'functions' | 'operators'>('fields')
  const [functionSearch, setFunctionSearch] = useState('')
  const [activeHoverFunc, setActiveHoverFunc] = useState<{ name: string; doc: string; snippet: string; category?: string } | null>(null)
  const [selectedHelpFunc, setSelectedHelpFunc] = useState<{ name: string; doc: string; snippet: string; category?: string } | null>(null)
  
  // Number field options state
  const [numberDecimalPlaces, setNumberDecimalPlaces] = useState<number>(0)
  const [numberFormat, setNumberFormat] = useState<string>('thousands')
  const [numberPrefix, setNumberPrefix] = useState<string>('')
  const [numberSuffix, setNumberSuffix] = useState<string>('')

  const [fetchedTargetFields, setFetchedTargetFields] = useState<any[]>([])

  const selectedRelationField = fields?.find((f: any) => f.id === relationFieldId)
  const relOpts = typeof selectedRelationField?.options === 'object'
    ? selectedRelationField.options
    : safeJsonParse<Record<string, any>>(selectedRelationField?.options, {})
  const targetTableIdFromRel = Number(
    relOpts?.targetTableId ?? relOpts?.link_row_table_id ?? relOpts?.target_table_id ?? (selectedRelationField as any)?.targetTableId
  ) || null
  const targetTableObj = tables?.find((t: any) => t.id === targetTableIdFromRel)

  useEffect(() => {
    if (!targetTableIdFromRel) {
      setFetchedTargetFields([])
      return
    }
    if (targetTableObj?.fields && targetTableObj.fields.length > 0) {
      setFetchedTargetFields(targetTableObj.fields)
    } else {
      fetch(`/api/tables/${targetTableIdFromRel}/fields`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setFetchedTargetFields(data)
        })
        .catch(() => setFetchedTargetFields([]))
    }
  }, [targetTableIdFromRel, targetTableObj])

  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const formulaTextareaRef = useRef<HTMLTextAreaElement>(null)

  const insertAtCursor = (text: string, cursorOffsetFromEnd: number = 0) => {
    const el = formulaTextareaRef.current
    if (!el) {
      setFormula(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)
      return
    }
    const start = el.selectionStart ?? formula.length
    const end = el.selectionEnd ?? formula.length
    const before = formula.slice(0, start)
    const after = formula.slice(end)

    // Add spacing if needed
    const needsLeadingSpace = before.length > 0 && !/\s|[({,]/.test(before.slice(-1)) && !/^[),%]/.test(text)
    const prefix = needsLeadingSpace ? ' ' : ''
    const insertedText = prefix + text

    const newFormula = before + insertedText + after
    setFormula(newFormula)

    const targetPos = start + insertedText.length - cursorOffsetFromEnd

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(targetPos, targetPos)
    })
  }

  let formulaSyntaxError = ''
  if (formula && formula.trim()) {
    try {
      parseFormula(formula)
    } catch (err: any) {
      formulaSyntaxError = err.message || '語法錯誤'
    }
  }

  const [createRelatedField, setCreateRelatedField] = useState<boolean>(true)
  const [allowMultiple, setAllowMultiple] = useState<boolean>(true)


  useEffect(() => {
    if (show) {
      if (editField) {

        setName(editField.name || '')
        setType(editField.type || 'text')
        setTypeDropdownOpen(false)
        let choices: string[] = []
        let formulaStr = ''
        if (editField.options) {
          try {
            let parsed = typeof editField.options === 'string' ? JSON.parse(editField.options) : editField.options
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed) } catch {}
            }
            if (Array.isArray(parsed)) choices = parsed.map(String)
            else if (parsed && Array.isArray(parsed.choices)) choices = parsed.choices.map(String)
            else if (parsed && Array.isArray(parsed.select_options)) choices = parsed.select_options.map((o: any) => typeof o === 'object' ? o.value || o.name || String(o) : String(o))

            if (parsed && typeof parsed === 'object') {
              if (parsed.targetTableId) setTargetTableId(Number(parsed.targetTableId))
              if (parsed.relationFieldId) setRelationFieldId(Number(parsed.relationFieldId))
              if (parsed.targetFieldId) setTargetFieldId(Number(parsed.targetFieldId))
              if (parsed.rollupFunction) setRollupFunction(parsed.rollupFunction)
              if (typeof parsed.createRelatedField === 'boolean') setCreateRelatedField(parsed.createRelatedField)
              if (typeof parsed.allowMultiple === 'boolean') setAllowMultiple(parsed.allowMultiple)
              if (parsed.formula) {
                formulaStr = String(parsed.formula)
              }
              if (typeof parsed.number_decimal_places === 'number') {
                setNumberDecimalPlaces(parsed.number_decimal_places)
              }
              if (parsed.number_format) setNumberFormat(parsed.number_format)
              if (parsed.number_prefix) setNumberPrefix(parsed.number_prefix)
              if (parsed.number_suffix) setNumberSuffix(parsed.number_suffix)
            } else if (typeof editField.options === 'string' && !editField.options.startsWith('{')) {
              formulaStr = editField.options
            }
          } catch {
            if (typeof editField.options === 'string') formulaStr = editField.options
          }
        }
        setOptionsList(choices)
        setFormula(formulaStr)
      } else {
        setName('Single line text')
        setType('text')
        setTypeDropdownOpen(true)
        setTypeSearch('')
        setOptionsList([])
        setFormula('')
        setRelationFieldId(null)
        setTargetFieldId(null)
        setRollupFunction('sum')
        setNumberDecimalPlaces(0)
        setNumberFormat('thousands')
        setNumberPrefix('')
        setNumberSuffix('')
        setCreateRelatedField(true)
        setAllowMultiple(true)
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
    { key: 'ai_prompt', label: 'AI prompt', icon: <Sparkles size={16} /> },
    { key: 'latest_comment', label: '最新留言紀錄 (Latest comment)', icon: <MessageSquare size={16} /> }
  ]

  const filteredTypes = fieldTypeItems.filter(ft =>
    ft.label.toLowerCase().includes(typeSearch.toLowerCase()) ||
    ft.key.toLowerCase().includes(typeSearch.toLowerCase())
  )

  const selectedTypeObj = fieldTypeItems.find(ft => ft.key === type || (ft.key === 'phone_number' && type === 'phone') || (ft.key === 'collaborators' && type === 'collaborator')) || fieldTypeItems[0]

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
        parsedOptions = { targetTableId, createRelatedField, allowMultiple }
      } else if ((type === 'lookup' || type === 'rollup') && relationFieldId) {
        parsedOptions = {
          relationFieldId,
          targetFieldId,
          ...(type === 'rollup' && { rollupFunction })
        }
      } else if (type === 'formula') {
        parsedOptions = { formula }
      } else if (type === 'number') {
        parsedOptions = {
          number_decimal_places: numberDecimalPlaces,
          number_format: numberFormat,
          number_prefix: numberPrefix,
          number_suffix: numberSuffix
        }
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
    <Modal show={show} onClose={onClose} title="" size={type === 'formula' ? 'medium' : 'small'} overflowVisible={true}>
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
              color: activeTab === 'basic' ? '#18181B' : '#71717A',
              borderBottom: activeTab === 'basic' ? '2px solid #18181B' : '2px solid transparent',
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
              color: activeTab === 'advanced' ? '#18181B' : '#71717A',
              borderBottom: activeTab === 'advanced' ? '2px solid #18181B' : '2px solid transparent',
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
            {type === 'number' && (
              <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  數字欄位設定 (Number Options)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                      小數位數 (Decimal Places)
                    </label>
                    <select
                      value={numberDecimalPlaces}
                      onChange={(e) => setNumberDecimalPlaces(Number(e.target.value))}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value={0}>0 (整數 1234)</option>
                      <option value={1}>1 (1234.5)</option>
                      <option value={2}>2 (1234.56)</option>
                      <option value={3}>3 (1234.567)</option>
                      <option value={4}>4 (1234.5678)</option>
                      <option value={5}>5 (1234.56789)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                      格式 (Format)
                    </label>
                    <select
                      value={numberFormat}
                      onChange={(e) => setNumberFormat(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="thousands">千分位 (1,234.56)</option>
                      <option value="standard">一般數字 (1234.56)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                      前綴單位 (Prefix, 如 $, NT$)
                    </label>
                    <input
                      type="text"
                      value={numberPrefix}
                      onChange={(e) => setNumberPrefix(e.target.value)}
                      placeholder="如 $, NT$"
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                      後綴單位 (Suffix, 如 %, 元)
                    </label>
                    <input
                      type="text"
                      value={numberSuffix}
                      onChange={(e) => setNumberSuffix(e.target.value)}
                      placeholder="如 %, 元, kg"
                      style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>
            )}

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
                    style={{ padding: '6px 12px', background: '#18181B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {type === 'link_row' && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                    Target Table (目標表格)
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={createRelatedField}
                      onChange={(e) => setCreateRelatedField(e.target.checked)}
                      style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span>自動在目標表格建立反向關聯欄位 (Create reverse link field)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowMultiple}
                      onChange={(e) => setAllowMultiple(e.target.checked)}
                      style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <span>允許關聯多筆資料 (Allow multiple linked rows)</span>
                  </label>
                </div>
              </div>
            )}


            {(type === 'lookup' || type === 'rollup') && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    Relation Field (關聯欄位)
                  </label>
                  <select
                    value={relationFieldId || ''}
                    onChange={(e) => {
                      setRelationFieldId(Number(e.target.value) || null)
                      setTargetFieldId(null)
                    }}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  >
                    <option value="">Select relation field...</option>
                    {fields?.filter(f => f.type === 'link_row').map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    Target Field (目標欄位)
                  </label>
                  <select
                    value={targetFieldId || ''}
                    onChange={(e) => setTargetFieldId(Number(e.target.value) || null)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                    disabled={!relationFieldId || fetchedTargetFields.length === 0}
                  >
                    <option value="">Select target field...</option>
                    {fetchedTargetFields.map((f: any) => (
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
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    公式表達式 (Formula Expression)
                  </label>
                  {formula.trim() && (
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      background: formulaSyntaxError ? '#fee2e2' : '#dcfce7',
                      color: formulaSyntaxError ? '#991b1b' : '#166534',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {formulaSyntaxError ? `⚠️ 語法錯誤: ${formulaSyntaxError}` : '✓ 語法正確 (Valid)'}
                    </span>
                  )}
                </div>

                <textarea
                  ref={formulaTextareaRef}
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="輸入公式，例如: field_1 + field_2 或 CONCAT(field_1, ' ', field_2)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: formulaSyntaxError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Formula Explorer & Library Panel */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', background: '#ffffff' }}>
                  {/* Explorer Tabs Header */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setFormulaTab('fields')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: formulaTab === 'fields' ? '#ffffff' : 'transparent',
                        fontWeight: formulaTab === 'fields' ? 600 : 400,
                        color: formulaTab === 'fields' ? '#3F6212' : '#64748b',
                        borderBottom: formulaTab === 'fields' ? '2px solid #3F6212' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      可用欄位 (Fields)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormulaTab('functions')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: formulaTab === 'functions' ? '#ffffff' : 'transparent',
                        fontWeight: formulaTab === 'functions' ? 600 : 400,
                        color: formulaTab === 'functions' ? '#3F6212' : '#64748b',
                        borderBottom: formulaTab === 'functions' ? '2px solid #3F6212' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      公式庫 (Functions)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormulaTab('operators')}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        background: formulaTab === 'operators' ? '#ffffff' : 'transparent',
                        fontWeight: formulaTab === 'operators' ? 600 : 400,
                        color: formulaTab === 'operators' ? '#3F6212' : '#64748b',
                        borderBottom: formulaTab === 'operators' ? '2px solid #3F6212' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      運算子 (Operators)
                    </button>
                  </div>

                  {/* Explorer Tab Content */}
                  <div style={{ padding: '8px 12px', maxHeight: '160px', overflowY: 'auto', fontSize: '12px' }}>
                    {formulaTab === 'fields' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {fields && fields.length > 0 ? (
                          fields.map((f, idx) => {
                            const shortAlias = `F${idx + 1}`
                            return (
                              <div
                                key={f.id}
                                onClick={() => insertAtCursor(shortAlias)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  color: '#334155',
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                title={`插入短代號 ${shortAlias} (${f.name})`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontFamily: 'monospace', color: '#18181B', background: '#F4F4F5', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                                    {shortAlias}
                                  </span>
                                  <span style={{ fontWeight: 500 }}>{f.name}</span>
                                </div>
                                <span style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '11px' }}>field_{f.id}</span>
                              </div>
                            )
                          })
                        ) : (
                          <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '8px 0' }}>尚無可用欄位</div>
                        )}
                      </div>
                    )}

                    {formulaTab === 'functions' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ position: 'sticky', top: 0, background: '#fff', paddingBottom: '6px', zIndex: 1 }}>
                          <input
                            type="text"
                            value={functionSearch}
                            onChange={(e) => setFunctionSearch(e.target.value)}
                            placeholder="搜尋函數 (Search functions)..."
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              fontSize: '12px',
                              outline: 'none',
                              background: '#f8fafc'
                            }}
                          />
                        </div>
                        {getSupportedFunctions()
                          .map(cat => ({
                            ...cat,
                            funcs: cat.funcs.map(f => ({ ...f, category: cat.category })).filter(fn =>
                              !functionSearch.trim() ||
                              fn.name.toLowerCase().includes(functionSearch.toLowerCase()) ||
                              fn.doc.toLowerCase().includes(functionSearch.toLowerCase())
                            )
                          }))
                          .filter(cat => cat.funcs.length > 0)
                          .map((cat, idx) => (
                          <div key={idx}>
                            <div style={{ fontWeight: 600, color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>{cat.category}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                              {cat.funcs.map((fn, fIdx) => {
                                const isSelected = selectedHelpFunc?.name === fn.name
                                return (
                                  <button
                                    key={fIdx}
                                    type="button"
                                    title={fn.doc}
                                    onClick={() => {
                                      insertAtCursor(`${fn.name}()`, 1)
                                      setSelectedHelpFunc(fn)
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#F4F4F5'
                                      setActiveHoverFunc(fn)
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = isSelected ? '#F4F4F5' : '#f8fafc'
                                    }}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '4px',
                                      border: isSelected ? '1px solid #3F6212' : '1px solid #cbd5e1',
                                      background: isSelected ? '#F4F4F5' : '#f8fafc',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      fontFamily: 'monospace',
                                      color: isSelected ? '#2d470d' : '#3F6212',
                                      fontWeight: isSelected ? 700 : 500
                                    }}
                                  >
                                    {fn.name}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {formulaTab === 'operators' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px 0' }}>
                        {['+', '-', '*', '/', '%', '^', '&', '=', '<>', '>', '<', '>=', '<=', '(', ')', ',', '""'].map((op, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => insertAtCursor(op)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#f1f5f9',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: '#0f172a'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                          >
                            {op}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Function Description & Help Panel (Baserow Style) */}
                {(() => {
                  const displayFunc = activeHoverFunc || selectedHelpFunc
                  return (
                    <div style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      background: displayFunc ? '#f8fafc' : '#f1f5f9',
                      transition: 'all 0.15s ease-in-out'
                    }}>
                      {displayFunc ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '14px',
                                fontWeight: 700,
                                background: '#18181B',
                                color: '#ffffff',
                                padding: '2px 8px',
                                borderRadius: '4px'
                              }}>
                                {displayFunc.name}
                              </span>
                              {displayFunc.category && (
                                <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontWeight: 500 }}>
                                  {displayFunc.category}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => insertAtCursor(`${displayFunc.name}()`, 1)}
                              style={{
                                fontSize: '11px',
                                padding: '3px 10px',
                                background: '#18181B',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              + 插入 {displayFunc.name}()
                            </button>
                          </div>

                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' }}>
                              語法說明 (Syntax)
                            </div>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>
                              {displayFunc.doc}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' }}>
                              使用範例 (Example)
                            </div>
                            <div style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              padding: '6px 10px',
                              borderRadius: '4px',
                              color: '#18181B',
                              fontWeight: 600,
                              wordBreak: 'break-all'
                            }}>
                              <code>{displayFunc.snippet}</code>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12px' }}>
                          <span style={{ fontSize: '16px' }}>💡</span>
                          <span>將滑鼠懸停於上方公式庫中的任何函數，或點擊函數，即可在此處查看詳細語法與範例說明。</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
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
  const { t } = useI18n()
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
    <Modal show={show} onClose={onClose} title={t('nav.createTable')} size="small">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            資料表名稱
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: '#94a3b8', zIndex: 2 }}>
              <Table size={16} />
            </div>
            <input
              type="text"
              style={{
                width: '100%',
                height: '44px',
                paddingLeft: '42px',
                paddingRight: '14px',
                fontSize: '14px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：主要清單、訂單資料..."
              autoFocus
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            按 <kbd style={{ padding: '2px 6px', fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: '4px', border: '1px solid #cbd5e1' }}>↵ Enter</kbd> 送出
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
            <Button type="secondary" size="regular" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" size="regular" onClick={handleSubmit} loading={loading}>
              {loading ? t('common.loading') : t('common.confirm')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}


