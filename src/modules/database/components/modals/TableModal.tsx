'use client'

import React, { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { Table } from 'lucide-react'

export interface TableModalProps {
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
