'use client'

import React, { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { LayoutGrid, Kanban, LayoutTemplate, Calendar, Clock, FormInput } from 'lucide-react'

export interface ViewModalProps {
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
  const { t } = useI18n()
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
    <Modal show={show} onClose={onClose} title={t('views.addView')} size="medium">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            {t('views.viewName')}
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
            {t('views.viewType')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
            {[
              { id: 'grid', label: t('views.grid'), icon: LayoutGrid },
              { id: 'kanban', label: t('views.kanban'), icon: Kanban },
              { id: 'gallery', label: t('views.gallery'), icon: LayoutTemplate },
              { id: 'calendar', label: t('views.calendar'), icon: Calendar },
              { id: 'timeline', label: t('views.timeline'), icon: Clock },
              { id: 'form', label: t('views.form'), icon: FormInput }
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
            {t('common.createEnter')}
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
