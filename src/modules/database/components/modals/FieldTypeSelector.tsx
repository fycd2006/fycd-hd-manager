import React, { useState, useRef } from 'react'
import {
  Type, AlignLeft, Plug, Hash, Star, CheckCircle2, Calendar, Edit3, User,
  Plus, UserCheck, Clock, Link2, Mail, CheckCircle, List, Phone,
  Calculator, Grid, Box, Glasses, Users, Tag, Binary, Lock, FileEdit,
  Sparkles, Search, ChevronDown, MessageSquare
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/i18nContext'
import PopoverPortal from '@/components/ui/PopoverPortal'

interface FieldTypeSelectorProps {
  type: string
  setType: (type: string) => void
  setName: (name: string) => void
  typeDropdownOpen: boolean
  setTypeDropdownOpen: (open: boolean) => void
}

export function FieldTypeSelector({
  type,
  setType,
  setName,
  typeDropdownOpen,
  setTypeDropdownOpen,
}: FieldTypeSelectorProps) {
  const { t } = useI18n()
  const [typeSearch, setTypeSearch] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const fieldTypeItems = [
    { key: 'text', label: t('fieldTypes.text'), icon: <Type size={16} /> },
    { key: 'long_text', label: t('fieldTypes.long_text'), icon: <AlignLeft size={16} /> },
    { key: 'link_row', label: t('fieldTypes.link_row'), icon: <Plug size={16} /> },
    { key: 'number', label: t('fieldTypes.number'), icon: <Hash size={16} /> },
    { key: 'rating', label: t('fieldTypes.rating'), icon: <Star size={16} /> },
    { key: 'boolean', label: t('fieldTypes.boolean'), icon: <CheckCircle2 size={16} /> },
    { key: 'date', label: t('fieldTypes.date'), icon: <Calendar size={16} /> },
    { key: 'last_modified_on', label: t('fieldTypes.last_modified_on'), icon: <Edit3 size={16} /> },
    { key: 'last_modified_by', label: t('fieldTypes.last_modified_by'), icon: <User size={16} /> },
    { key: 'created_on', label: t('fieldTypes.created_on'), icon: <Plus size={16} /> },
    { key: 'created_by', label: t('fieldTypes.created_by'), icon: <UserCheck size={16} /> },
    { key: 'duration', label: t('fieldTypes.duration'), icon: <Clock size={16} /> },
    { key: 'url', label: t('fieldTypes.url'), icon: <Link2 size={16} /> },
    { key: 'email', label: t('fieldTypes.email'), icon: <Mail size={16} /> },
    { key: 'single_select', label: t('fieldTypes.single_select'), icon: <CheckCircle size={16} /> },
    { key: 'multiple_select', label: t('fieldTypes.multiple_select'), icon: <List size={16} /> },
    { key: 'phone_number', label: t('fieldTypes.phone_number'), icon: <Phone size={16} /> },
    { key: 'formula', label: t('fieldTypes.formula'), icon: <Calculator size={16} /> },
    { key: 'count', label: t('fieldTypes.count'), icon: <Grid size={16} /> },
    { key: 'rollup', label: t('fieldTypes.rollup'), icon: <Box size={16} /> },
    { key: 'lookup', label: t('fieldTypes.lookup'), icon: <Glasses size={16} /> },
    { key: 'collaborators', label: t('fieldTypes.collaborators'), icon: <Users size={16} /> },
    { key: 'uuid', label: t('fieldTypes.uuid'), icon: <Tag size={16} /> },
    { key: 'autonumber', label: t('fieldTypes.autonumber'), icon: <Binary size={16} /> },
    { key: 'password', label: t('fieldTypes.password'), icon: <Lock size={16} /> },
    { key: 'edit_row_link', label: t('fieldTypes.edit_row_link'), icon: <FileEdit size={16} /> },
    { key: 'ai_prompt', label: t('fieldTypes.ai_prompt'), icon: <Sparkles size={16} /> },
    { key: 'latest_comment', label: t('fieldTypes.latest_comment'), icon: <MessageSquare size={16} /> }
  ]

  const filteredTypes = fieldTypeItems.filter(ft =>
    ft.label.toLowerCase().includes(typeSearch.toLowerCase()) ||
    ft.key.toLowerCase().includes(typeSearch.toLowerCase())
  )

  const selectedTypeObj = fieldTypeItems.find(ft => ft.key === type || (ft.key === 'phone_number' && type === 'phone') || (ft.key === 'collaborators' && type === 'collaborator')) || fieldTypeItems[0]

  const handleToggleDropdown = () => {
    if (!typeDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800
      const dropdownHeight = 320
      
      let top = rect.bottom + 4
      if (top + dropdownHeight > screenHeight - 16 && rect.top > dropdownHeight + 16) {
        top = rect.top - dropdownHeight - 4
      }

      setDropdownPos({
        top,
        left: rect.left,
        width: rect.width
      })
      setTypeDropdownOpen(true)
    } else {
      setTypeDropdownOpen(false)
      setDropdownPos(null)
    }
  }

  return (
    <div style={{ position: 'relative', marginBottom: '16px' }}>
      <div
        ref={triggerRef}
        onClick={handleToggleDropdown}
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
          fontSize: '14px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#334155' }}>
          <span style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
            {selectedTypeObj.icon}
          </span>
          <span>{selectedTypeObj.label}</span>
        </div>
        <ChevronDown size={16} style={{ color: '#64748b', transform: typeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </div>

      {typeDropdownOpen && dropdownPos && (
        <PopoverPortal
          show={typeDropdownOpen}
          onClose={() => {
            setTypeDropdownOpen(false)
            setDropdownPos(null)
          }}
          position={dropdownPos}
          zIndex={1000005}
        >
          <div
            style={{
              width: `${dropdownPos.width}px`,
              maxHeight: '320px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 10px 30px -5px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#fafafa' }}>
              <Search size={16} style={{ color: '#94a3b8', marginRight: '8px', flexShrink: 0 }} />
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

            <div style={{ overflowY: 'auto', padding: '6px', maxHeight: '260px' }}>
              {filteredTypes.map((ft) => (
                <div
                  key={ft.key}
                  onClick={() => {
                    setType(ft.key)
                    setName(ft.label)
                    setTypeDropdownOpen(false)
                    setDropdownPos(null)
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
                    color: '#334155',
                    transition: 'background 0.1s ease'
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
                <div style={{ padding: '16px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                  找不到符合的欄位類型
                </div>
              )}
            </div>
          </div>
        </PopoverPortal>
      )}
    </div>
  )
}
