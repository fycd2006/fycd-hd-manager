'use client'

import React from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { Sparkles, ArrowUpCircle, CheckCircle2 } from 'lucide-react'
import type { VersionRelease, ChangelogCategory } from '@/config/changelog'

export interface ChangelogModalProps {
  open: boolean
  onClose: () => void
  currentVersion: string
  latestVersion?: string | null
  hasUpdate?: boolean
  onUpdate?: () => void
  changelog: VersionRelease[]
}

const CATEGORY_MAP: Record<ChangelogCategory, { label: string; badgeBg: string; badgeColor: string }> = {
  feature: {
    label: '✨ 新功能',
    badgeBg: 'var(--brand-green-light)',
    badgeColor: 'var(--brand-green-text)',
  },
  improvement: {
    label: '⚡ 體驗優化',
    badgeBg: 'var(--brand-orange-light)',
    badgeColor: 'var(--brand-orange-main)',
  },
  fix: {
    label: '🐛 問題修復',
    badgeBg: 'var(--bg-tertiary)',
    badgeColor: 'var(--text-secondary)',
  },
  security: {
    label: '🔒 安全防護',
    badgeBg: 'var(--bg-tertiary)',
    badgeColor: 'var(--danger)',
  },
}

export function ChangelogModal({
  open,
  onClose,
  currentVersion,
  latestVersion,
  hasUpdate = false,
  onUpdate,
  changelog,
}: ChangelogModalProps) {
  if (!open) return null

  return (
    <Modal
      show={open}
      onClose={onClose}
      size="medium"
      title="版本更新紀錄"
      contentScrollable
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Version Info Header Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              目前運行版本：
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {currentVersion}
            </span>
          </div>
        </div>

        {/* Update Banner if new version available */}
        {hasUpdate && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--brand-orange-light)',
              border: '1px solid var(--border-active)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} style={{ color: 'var(--brand-orange-main)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-orange-main)' }}>
                  發現新版本 {latestVersion} 發布！
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  立即更新以獲得最新系統改進與效能最佳化。
                </div>
              </div>
            </div>
            {onUpdate && (
              <Button
                type="primary"
                size="small"
                icon={<ArrowUpCircle size={14} />}
                onClick={onUpdate}
              >
                立即更新
              </Button>
            )}
          </div>
        )}

        {/* Releases List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            maxHeight: '440px',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {changelog.map((release) => {
            const isCurrent = release.version === currentVersion

            return (
              <div
                key={release.version}
                style={{
                  borderRadius: 'var(--radius-md)',
                  border: isCurrent
                    ? '1.5px solid var(--brand-green-border)'
                    : '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '14px 16px',
                  transition: 'box-shadow var(--transition-fast)',
                }}
              >
                {/* Release Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {release.version}
                    </span>
                    {release.title && (
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {release.title}
                      </span>
                    )}
                    {isCurrent && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: 'var(--brand-green-light)',
                          color: 'var(--brand-green-text)',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        目前使用中
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {release.releaseDate}
                  </span>
                </div>

                {/* Release Items */}
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {release.items.map((item, idx) => {
                    const cat = CATEGORY_MAP[item.type] || CATEGORY_MAP.feature
                    return (
                      <li
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: cat.badgeBg,
                            color: cat.badgeColor,
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {cat.label}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <Button type="secondary" size="small" onClick={onClose}>
            關閉
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default ChangelogModal
