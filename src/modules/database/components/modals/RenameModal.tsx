'use client'

import React, { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { Edit3 } from 'lucide-react'

export interface RenameModalProps {
  show: boolean
  type: 'workspace' | 'database' | 'table' | null
  initialValue: string
  onClose: () => void
  onSubmit: (newName: string) => Promise<void>
}

export function RenameModal({ show, type, initialValue, onClose, onSubmit }: RenameModalProps) {
  const { t } = useI18n()
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
    if (type === 'workspace') return t('modals.renameWorkspace') || '重新命名工作區'
    if (type === 'database') return t('modals.renameDatabase') || '重新命名資料庫'
    if (type === 'table') return t('modals.renameTable') || '重新命名資料表'
    return t('common.rename') || '重新命名'
  }

  return (
    <Modal show={show} onClose={onClose} title={getTitle()} size="small">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: 0, padding: 0 }}>
            {t('common.name') || '名稱'}
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
              placeholder={t('common.enterName') || '請輸入名稱...'}
              autoFocus
            />
          </div>
        </div>
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
