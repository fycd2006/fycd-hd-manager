'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import type { TrashEntry } from '@/modules/database/types'
import { fetchRecentlyDeleted, restoreRecentlyDeleted } from '@/modules/database/services/trash'

export interface RecentlyDeletedModalProps {
  open: boolean
  onClose: () => void
  onRestored: () => void
}

const GROUPS: { type: TrashEntry['type']; key: string; fallback: string }[] = [
  { type: 'workspace', key: 'trash.groupWorkspace', fallback: '工作區' },
  { type: 'database', key: 'trash.groupDatabase', fallback: '資料庫' },
  { type: 'table', key: 'trash.groupTable', fallback: '資料表' },
]

export function RecentlyDeletedModal({ open, onClose, onRestored }: RecentlyDeletedModalProps) {
  const { t } = useI18n()
  const [items, setItems] = useState<TrashEntry[] | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setItems(await fetchRecentlyDeleted())
  }, [])

  // 每次開啟時清掉舊錯誤（render 期間比對，不在 effect 內 setState）
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) setErrors({})
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetchRecentlyDeleted().then((list) => {
      if (!cancelled) setItems(list)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleRestore = async (entry: TrashEntry) => {
    const key = `${entry.type}:${entry.id}`
    if (busyKey) return
    setBusyKey(key)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      const res = await restoreRecentlyDeleted(entry.type, entry.id)
      if (res.ok) {
        onRestored()
        await load()
      } else {
        setErrors((prev) => ({ ...prev, [key]: res.error || t('trash.restoreFailed') || '還原失敗' }))
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Modal show={open} onClose={onClose} title={t('trash.recentlyDeletedTitle') || '最近刪除'} size="medium">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', boxSizing: 'border-box' }}>
        {items !== null && items.length === 0 && (
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            {t('trash.empty') || '沒有最近刪除的項目'}
          </p>
        )}
        {GROUPS.map(({ type, key, fallback }) => {
          const group = (items ?? []).filter((i) => i.type === type)
          if (group.length === 0) return null
          return (
            <section key={type} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#475569' }}>{t(key) || fallback}</h3>
              {group.map((entry) => {
                const rowKey = `${entry.type}:${entry.id}`
                return (
                  <div key={rowKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                        {entry.parentName && (
                          <span style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.parentName}</span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {t('trash.daysLeft', { n: entry.daysLeft }) || `剩 ${entry.daysLeft} 天`}
                      </span>
                      <Button type="secondary" size="small" loading={busyKey === rowKey} disabled={busyKey !== null} onClick={() => handleRestore(entry)}>
                        {t('trash.restore') || '還原'}
                      </Button>
                    </div>
                    {errors[rowKey] && (
                      <span role="alert" style={{ fontSize: '12px', color: '#dc2626' }}>{errors[rowKey]}</span>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </Modal>
  )
}
