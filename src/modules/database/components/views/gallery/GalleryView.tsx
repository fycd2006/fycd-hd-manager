'use client'

import React from 'react'

interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
}

type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

interface TableRow {
  id: number
  tableId: number
  data: Record<string, CellValue>
  order: number
  createdAt: string
}

interface GalleryViewProps {
  fields: TableField[]
  rows: TableRow[]
  onExpandRow: (row: TableRow) => void
}

export default function GalleryView({
  fields,
  rows,
  onExpandRow,
}: GalleryViewProps) {
  const firstTextField = fields.find(f => f.type === 'text')

  if (rows.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h3>畫廊尚無資料</h3>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          建立一些列數據來在畫廊中顯示。
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        padding: '24px',
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '20px',
        maxHeight: '100%',
        alignContent: 'start',
        scrollbarWidth: 'thin',
      }}
    >
      {rows.map(row => {
        // Title field
        const titleKey = firstTextField ? `field_${firstTextField.id}` : Object.keys(row.data)[0]
        const title = row.data[titleKey] || `列 ID: ${row.id}`

        return (
          <div
            key={row.id}
            onClick={() => onExpandRow(row)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.borderColor = 'var(--border-color)'
            }}
          >
            {/* Card Header Placeholder */}
            <div
              style={{
                height: '140px',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-muted)'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </div>

            {/* Card Body */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(title)}
              </div>

              {/* Secondary fields (up to 3) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                {fields
                  .filter(f => f.id !== firstTextField?.id)
                  .slice(0, 3)
                  .map(f => {
                    const val = row.data[`field_${f.id}`]
                    if (val == null || val === '') return null
                    
                    let displayVal = String(val)
                    if (f.type === 'link_row' && Array.isArray(val)) {
                      displayVal = val.map(item => typeof item === 'object' ? (item as any)?.value : item).join(', ')
                    }

                    return (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{f.name}</span>
                        <span style={{ color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayVal}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
