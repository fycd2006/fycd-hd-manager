import React from 'react'
import { Check } from 'lucide-react'
import type { TableField } from '@/modules/database/types'

interface SortMenuProps {
  fields: TableField[]
  sortField: string | null
  setSortField: (field: string | null) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (order: 'asc' | 'desc') => void
  activeViewId: number | null
  saveViewConfig: (viewId: number, config: any) => void
}

export function SortMenu({
  fields,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  activeViewId,
  saveViewConfig
}: SortMenuProps) {
  const safeFields = Array.isArray(fields) ? fields : []

  return (
    <div className="sortings">
      <div className="sortings__empty" style={{ padding: '4px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
        <div style={{ marginBottom: '8px', textAlign: 'left', fontWeight: 600 }}>在此視圖中的記錄將不會被排序</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px', maxHeight: '180px', overflowY: 'auto' }}>
          {safeFields.map(f => {
            const key = `field_${f.id}`
            const isSelected = sortField === key
            return (
              <div
                key={f.id}
                onClick={() => {
                  const nextKey = isSelected ? null : key
                  setSortField(nextKey)
                  if (activeViewId) saveViewConfig(activeViewId, { sortField: nextKey })
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#F4F4F5' : 'transparent',
                  color: isSelected ? '#3F6212' : '#1e293b',
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <span>{f.name}</span>
                {isSelected && <Check size={14} />}
              </div>
            )
          })}
        </div>
        {sortField && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`button button--small ${sortOrder === 'asc' ? 'button--primary' : 'button--secondary'}`}
              onClick={() => {
                setSortOrder('asc')
                if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'asc' })
              }}
              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
            >
              A-Z
            </button>
            <button
              className={`button button--small ${sortOrder === 'desc' ? 'button--primary' : 'button--secondary'}`}
              onClick={() => {
                setSortOrder('desc')
                if (activeViewId) saveViewConfig(activeViewId, { sortOrder: 'desc' })
              }}
              style={{ flex: 1, padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
            >
              Z-A
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
