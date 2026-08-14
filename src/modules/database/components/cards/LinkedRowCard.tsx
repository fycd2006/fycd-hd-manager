import React, { useState } from 'react'
import { ExternalLink, Lock, X } from 'lucide-react'

export interface LinkedRowCardPreviewField {
  id: number
  name: string
  type: string
  value: any
}

export interface LinkedRowCardItem {
  id: number
  value?: string
  tableId?: number
  _accessDenied?: boolean
  tableName?: string
  previewFields?: LinkedRowCardPreviewField[]
}

export interface LinkedRowCardProps {
  item: LinkedRowCardItem
  onOpenDetail?: (id: number, tableId?: number, e?: React.MouseEvent) => void
  onDetach?: (id: number, e?: React.MouseEvent) => void
  showDetachButton?: boolean
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
}

export const LinkedRowCard: React.FC<LinkedRowCardProps> = ({
  item,
  onOpenDetail,
  onDetach,
  showDetachButton = false,
  disabled = false,
  className = '',
  style = {},
}) => {
  const [showPopover, setShowPopover] = useState(false)
  const isAccessDenied = Boolean(item._accessDenied)

  if (isAccessDenied) {
    return (
      <span
        className={`linked-row-card linked-row-card--denied ${className}`}
        style={{
          background: '#f1f5f9',
          color: '#94a3b8',
          border: '1px dashed #cbd5e1',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          cursor: 'not-allowed',
          userSelect: 'none',
          ...style,
        }}
        title="您未加入此關聯資料表所屬之工作區，無存取權限"
        data-testid="linked-row-card-denied"
      >
        <Lock size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
        <span>無存取權限</span>
        {showDetachButton && onDetach && (
          <button
            type="button"
            data-testid="detach-denied-button"
            onClick={(e) => {
              e.stopPropagation()
              onDetach(item.id, e)
            }}
            title="移除無效關聯"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'inline-flex',
              alignItems: 'center',
              color: '#94a3b8',
            }}
          >
            <X size={11} />
          </button>
        )}
      </span>
    )
  }

  const displayTitle = item.value || `列 ID: ${item.id}`

  return (
    <div
      className={`linked-row-card-wrapper ${className}`}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
      data-testid="linked-row-card"
    >
      <span
        data-testid="linked-row-card-chip"
        onClick={(e) => {
          if (!disabled && onOpenDetail) {
            onOpenDetail(item.id, item.tableId, e)
          }
        }}
        style={{
          background: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={`${displayTitle} (點擊查看詳情)`}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.background = '#bae6fd'
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.background = '#e0f2fe'
        }}
      >
        <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayTitle}</span>
        {!disabled && <ExternalLink size={10} color="#0284c7" style={{ flexShrink: 0, opacity: 0.85 }} />}
        {showDetachButton && onDetach && (
          <button
            type="button"
            data-testid="detach-button"
            onClick={(e) => {
              e.stopPropagation()
              onDetach(item.id, e)
            }}
            title="解除關聯"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              display: 'inline-flex',
              alignItems: 'center',
              color: '#0284c7',
            }}
          >
            <X size={12} />
          </button>
        )}
      </span>

      {/* Hover Preview Popover */}
      {showPopover && item.previewFields && item.previewFields.length > 0 && (
        <div
          data-testid="linked-row-popover"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '0',
            marginBottom: '6px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '10px 12px',
            minWidth: '200px',
            maxWidth: '280px',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
            {item.tableName || '關聯列摘要'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
            {displayTitle}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {item.previewFields.map((f) => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                <span style={{ color: '#64748b' }}>{f.name}:</span>
                <span
                  style={{
                    color: '#334155',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '140px',
                  }}
                >
                  {f.value != null ? String(f.value) : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LinkedRowCard
