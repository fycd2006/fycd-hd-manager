'use client'

import React, { useState } from 'react'
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
  fieldIndex?: number
  rowDetailsWidth?: number
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
  fieldIndex = 0,
  rowDetailsWidth = 56,
  summaryData,
  totalRowCount,
  aggregationMode,
  onSelectAggregationMode,
}: GridViewFieldFooterProps) {
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const isMenuOpen = popoverPos !== null

  const isNumeric = field.type === 'number' || field.type === 'rating'
  const currentMode = aggregationMode || (isNumeric ? 'sum' : 'count')
  const isPrimary = fieldIndex === 0

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
        position: isPrimary ? 'sticky' : 'relative',
        left: isPrimary ? `${rowDetailsWidth}px` : undefined,
        zIndex: isPrimary ? 24 : 1,
        flexShrink: 0,
        height: '44px',
        padding: '0 10px',
        borderRight: isPrimary ? '2px solid var(--border-color, #cbd5e1)' : '1px solid #e2e8f0',

        boxShadow: isPrimary ? '2px 0 5px -2px rgba(0, 0, 0, 0.08)' : undefined,
        whiteSpace: 'nowrap',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        background: isMenuOpen ? '#F4F4F5' : '#FAFAF9',
        transition: 'background 0.15s ease',
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
      title="點擊切換欄位統計方式"
    >
      {currentMode !== 'none' && displayText ? (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', fontWeight: 600, color: '#18181B', fontFamily: 'monospace' }}>
          {displayText}
        </span>
      ) : (
        <span style={{ fontSize: '12px', color: '#78716C', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={12} />
          統計
        </span>
      )}
      <ChevronDown size={12} color="#78716C" style={{ marginLeft: '4px', flexShrink: 0 }} />

      {/* React Portal Popover Menu with Backdrop Dismiss */}
      {isMenuOpen && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999998, backgroundColor: 'transparent', pointerEvents: 'auto' }}
          onClick={() => setPopoverPos(null)}
        >
          <div
            data-grid-portal="true"
            style={{
              position: 'fixed',
              left: `${popoverPos.x}px`,
              bottom: `${window.innerHeight - popoverPos.y + 4}px`,
              width: '200px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.16)',
              zIndex: 999999,
              padding: '6px 0',
              fontSize: '12px',
              color: '#334155',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '6px 12px 6px 12px', fontSize: '11px', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9', marginBottom: '4px' }}>
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
                  background: currentMode === item.key ? '#F4F4F5' : 'transparent',
                  fontWeight: currentMode === item.key ? 600 : 400,
                  color: currentMode === item.key ? '#3F6212' : '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={(e) => { if (currentMode !== item.key) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{item.label}</span>
                {currentMode === item.key && <Check size={14} color="#3F6212" />}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
