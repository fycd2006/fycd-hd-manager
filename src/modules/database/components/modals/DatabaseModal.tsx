'use client'

import React, { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { Database, UploadCloud } from 'lucide-react'

export interface DatabaseModalProps {
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
            {t('modals.databaseName')}
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
              placeholder={t('modals.databasePlaceholder')}
              autoFocus
            />
          </div>
        </div>

        {onOpenAirtableImport && (
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{t('modals.importExternal')}</span>
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
              <span>{t('modals.importAirtable')}</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingTop: '12px', boxSizing: 'border-box' }}>
          <div className="hidden sm:flex" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
            {t('common.submitEnter')}
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
