'use client'

import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Check, ChevronDown } from 'lucide-react'
import type { TableField } from '@/modules/database/types'

export interface FieldSummaryData {
  count: number
  emptyCount: number
  percentFilled: number
  sum: number | null
  avg: number | null
  min: any
  max: any
  uniqueCount: number
}

interface GridViewFieldFooterProps {
  field: TableField
  summaryData: FieldSummaryData
  totalRowCount: number
  aggregationMode: string
  onSelectAggregationMode: (fieldId: number, mode: string) => void
}

export const AGGREGATION_OPTIONS = [
  { key: 'none', label: '不顯示 (None)', category: 'common' },
  { key: 'count', label: '已填寫筆數 (Count)', category: 'common' },
  { key: 'empty_count', label: '未填寫筆數 (Empty)', category: 'common' },
  { key: 'percent', label: '填寫百分比 (%)', category: 'common' },
  { key: 'sum', label: '總和 (Sum)', category: 'numeric' },
  { key: 'avg', label: '平均值 (Average)', category: 'numeric' },
  { key: 'min', label: '最小值 (Min)', category: 'comparable' },
  { key: 'max', label: '最大值 (Max)', category: 'comparable' },
  { key: 'unique', label: '不重複項目數 (Unique)', category: 'text' },
]

export function isFieldCompatibleWithAggregation(field: TableField, aggKey: string): boolean {
  const isNumeric = field.type === 'number' || field.type === 'rating'
  const isComparable = isNumeric || field.type === 'date'
  
  if (aggKey === 'none' || aggKey === 'count' || aggKey === 'empty_count' || aggKey === 'percent') {
    return true
  }
  if (aggKey === 'sum' || aggKey === 'avg') {
    return isNumeric
  }
  if (aggKey === 'min' || aggKey === 'max') {
    return isComparable
  }
  if (aggKey === 'unique') {
    return true
  }
  return true
}

export default function GridViewFieldFooter({
  field,
  summaryData,
  totalRowCount,
  aggregationMode,
  onSelectAggregationMode,
}: GridViewFieldFooterProps) {
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const isMenuOpen = popoverPos !== null

  const isNumeric = field.type === 'number' || field.type === 'rating'
  const currentMode = aggregationMode || (isNumeric ? 'sum' : 'count')

  let displayText = ''
  if (currentMode === 'count') displayText = `${summaryData?.count || 0} 筆填寫`
  else if (currentMode === 'empty_count') displayText = `${summaryData?.emptyCount || 0} 筆空白`
  else if (currentMode === 'percent') displayText = `${summaryData?.percentFilled || 0}% 填寫率`
  else if (currentMode === 'sum') displayText = summaryData?.sum !== null ? `Σ ${summaryData.sum}` : `${summaryData?.count || 0} 筆`
  else if (currentMode === 'avg') displayText = summaryData?.avg !== null ? `均 ${summaryData.avg}` : `${summaryData?.count || 0} 筆`
  else if (currentMode === 'min') displayText = summaryData?.min !== null ? `小 ${summaryData.min}` : '-'
  else if (currentMode === 'max') displayText = summaryData?.max !== null ? `大 ${summaryData.max}` : '-'
  else if (currentMode === 'unique') displayText = `${summaryData?.uniqueCount || 0} 項不重複`
  else if (currentMode === 'none') displayText = ''

  const availableOptions = AGGREGATION_OPTIONS.filter(opt => isFieldCompatibleWithAggregation(field, opt.key))

  return (
    <div
      className="grid-view__summary-cell"
      style={{
        width: `var(--field-width-${field.id}, ${field.width || 180}px)`,
        flexShrink: 0,
        padding: '5px 8px',
        borderRight: '1px solid #e2e8f0',
        whiteSpace: 'nowrap',
        overflow: 'visible',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        background: isMenuOpen ? '#e0f2fe' : 'transparent',
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (isMenuOpen) {
          setPopoverPos(null)
        } else {
          const rect = e.currentTarget.getBoundingClientRect()
          setPopoverPos({ x: rect.left, y: rect.top })
        }
      }}
      title="點擊切換欄位統計方式 (Baserow Style)"
    >
      {currentMode !== 'none' && displayText ? (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', fontWeight: 500, color: '#334155' }}>
          {displayText}
        </span>
      ) : (
        <span style={{ fontSize: '12px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={12} />
          統計 (Summarize)
        </span>
      )}
      <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>▼</span>

      {/* React Portal Popover Menu */}
      {isMenuOpen && createPortal(
        <div
          data-grid-portal="true"
          style={{
            position: 'fixed',
            left: `${popoverPos.x}px`,
            bottom: `${window.innerHeight - popoverPos.y + 4}px`,
            width: '190px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
            zIndex: 999999,
            padding: '6px 0',
            fontSize: '12px',
            color: '#334155',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '4px 12px 6px 12px', fontSize: '11px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
            【{field.name}】統計方式
          </div>
          {availableOptions.map((item) => (
            <div
              key={item.key}
              onClick={() => {
                onSelectAggregationMode(field.id, item.key)
                setPopoverPos(null)
              }}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                background: currentMode === item.key ? '#f1f5f9' : 'transparent',
                fontWeight: currentMode === item.key ? 600 : 400,
                color: currentMode === item.key ? '#2563eb' : '#334155',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = '#f8fafc' }}
              onMouseLeave={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{item.label}</span>
              {currentMode === item.key && <Check size={14} color="#2563eb" />}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
