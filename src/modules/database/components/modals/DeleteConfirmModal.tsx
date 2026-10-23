'use client'

import React, { useState, useRef, useId } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'

export interface DeleteConfirmModalProps {
  open: boolean
  kind: 'workspace' | 'database'
  name: string
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

export function DeleteConfirmModal({ open, kind, name, onConfirm, onClose }: DeleteConfirmModalProps) {
  const { t } = useI18n()
  const inputId = useId()
  const [typed, setTyped] = useState('')
  const [loading, setLoading] = useState(false)
  const submitting = useRef(false)

  // 開啟或換目標時清空輸入（render 期間比對，不在 effect 內 setState）
  const [prevKey, setPrevKey] = useState({ open, name })
  if (prevKey.open !== open || prevKey.name !== name) {
    setPrevKey({ open, name })
    setTyped('')
  }

  // 必須與名稱完全相同（含前後空白）才可刪除
  const matches = typed === name

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!matches || submitting.current) return
    submitting.current = true
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const title =
    kind === 'workspace'
      ? t('trash.deleteWorkspaceTitle', { name }) || `刪除工作區「${name}」？`
      : t('trash.deleteDatabaseTitle', { name }) || `刪除資料庫「${name}」？`

  return (
    <Modal show={open} onClose={onClose} title={title} size="small">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', boxSizing: 'border-box' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
          {t('trash.deleteDescription') || '會移到「最近刪除」，30 天內可以還原，之後永久刪除。'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>
          <label htmlFor={inputId} style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', margin: 0, padding: 0 }}>
            {t('trash.typeNamePrompt', { name }) || `請輸入名稱「${name}」確認`}
          </label>
          <input
            id={inputId}
            type="text"
            style={{
              width: '100%',
              height: '44px',
              padding: '0 14px',
              fontSize: '14px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px' }}>
          <Button type="secondary" size="regular" onClick={onClose}>
            {t('common.cancel') || '取消'}
          </Button>
          <Button type="danger" size="regular" buttonType="submit" disabled={!matches} loading={loading} onClick={handleSubmit}>
            {t('common.delete') || '刪除'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
