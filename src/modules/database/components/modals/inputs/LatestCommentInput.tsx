'use client'

import React, { useState } from 'react'
import type { TableField } from '@/modules/database/types'
import { LatestCommentModal, parseLatestCommentEntries } from '../../views/grid/cells/LatestCommentModal'
import { useI18n } from '@/lib/i18n/i18nContext'

interface LatestCommentInputProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  readOnly?: boolean
}

export function LatestCommentInput({ field, value, onChange, readOnly }: LatestCommentInputProps) {
  const { t } = useI18n()
  const [isRelationOpen, setIsRelationOpen] = useState(false)

  const entries = parseLatestCommentEntries(value)
  const latest = entries.length > 0 ? entries[entries.length - 1] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsRelationOpen(true)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#0f172a',
          cursor: readOnly ? 'default' : 'pointer',
          textAlign: 'left',
          width: '100%',
          transition: 'all 0.15s ease'
        }}
        className="hover:border-orange-400"
      >
        {latest ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
            <span style={{ fontSize: '13px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {latest.content}
            </span>
            <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0, marginLeft: 'auto' }}>
              {latest.time}
            </span>
          </div>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>{t('advancedInputs.openHistory')}</span>
        )}
      </button>

      {isRelationOpen && (
        <LatestCommentModal
          show={true}
          fieldName={field.name}
          value={value}
          onChange={onChange}
          onClose={() => setIsRelationOpen(false)}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
