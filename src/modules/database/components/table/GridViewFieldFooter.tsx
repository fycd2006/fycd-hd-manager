'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Check, ChevronDown } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'
import { SlidingNumber } from '@/components/animate-ui/primitives/texts/sliding-number'

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

const AGGREGATION_KEYS = [
  { key: 'none', category: 'common' },
  { key: 'count', category: 'common' },
  { key: 'empty_count', category: 'common' },
  { key: 'percent', category: 'common' },
  { key: 'sum', category: 'numeric' },
  { key: 'avg', category: 'numeric' },
  { key: 'min', category: 'comparable' },
  { key: 'max', category: 'comparable' },
  { key: 'unique', category: 'text' },
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
  const { t } = useI18n()
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const isMenuOpen = popoverPos !== null

  const isNumeric = field.type === 'number' || field.type === 'rating'
  const currentMode = aggregationMode || (isNumeric ? 'sum' : 'count')
  const isPrimary = fieldIndex === 0

  const renderDisplayContent = () => {
    if (currentMode === 'none') return null
    if (currentMode === 'count') {
      return <SlidingNumber number={summaryData?.count || 0} initiallyStable={true} />
    }
    if (currentMode === 'empty_count') {
      return <SlidingNumber number={summaryData?.emptyCount || 0} initiallyStable={true} />
    }
    if (currentMode === 'percent') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <SlidingNumber number={summaryData?.percentFilled || 0} initiallyStable={true} />%
        </span>
      )
    }
    if (currentMode === 'sum') {
      if (summaryData?.sum !== null && summaryData?.sum !== undefined) {
        const isInt = Number.isInteger(summaryData.sum)
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <span>Σ</span>
            <SlidingNumber number={summaryData.sum} decimalPlaces={isInt ? 0 : 2} thousandSeparator="," initiallyStable={true} />
          </span>
        )
      }
      return <SlidingNumber number={summaryData?.count || 0} initiallyStable={true} />
    }
    if (currentMode === 'avg') {
      if (summaryData?.avg !== null && summaryData?.avg !== undefined) {
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <span>x̄</span>
            <SlidingNumber number={summaryData.avg} decimalPlaces={2} initiallyStable={true} />
          </span>
        )
      }
      return <SlidingNumber number={summaryData?.count || 0} initiallyStable={true} />
    }
    if (currentMode === 'min') {
      if (summaryData?.min !== null && summaryData?.min !== undefined) {
        const num = Number(summaryData.min)
        if (!isNaN(num)) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>Min</span>
              <SlidingNumber number={num} initiallyStable={true} />
            </span>
          )
        }
        return `Min ${summaryData.min}`
      }
      return '-'
    }
    if (currentMode === 'max') {
      if (summaryData?.max !== null && summaryData?.max !== undefined) {
        const num = Number(summaryData.max)
        if (!isNaN(num)) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <span>Max</span>
              <SlidingNumber number={num} initiallyStable={true} />
            </span>
          )
        }
        return `Max ${summaryData.max}`
      }
      return '-'
    }
    if (currentMode === 'unique') {
      return <SlidingNumber number={summaryData?.uniqueCount || 0} initiallyStable={true} />
    }
    return null
  }

  const availableOptions = AGGREGATION_KEYS
    .filter(opt => isFieldCompatibleWithAggregation(field, opt.key))
    .map(opt => ({ ...opt, label: t(`footer.${opt.key}`) }))

  const displayContent = renderDisplayContent()

  return (
    <div
      className="grid-view__summary-cell"
      style={{
        width: `var(--field-width-${field.id}, ${field.width || 180}px)`,
        minWidth: `var(--field-width-${field.id}, ${field.width || 180}px)`,
        maxWidth: `var(--field-width-${field.id}, ${field.width || 180}px)`,
        position: isPrimary ? 'sticky' : 'relative',
        left: isPrimary ? `${rowDetailsWidth}px` : undefined,
        zIndex: isPrimary ? 24 : 1,
        flexShrink: 0,
        boxSizing: 'border-box',
        height: '100%',
        minHeight: '100%',
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
      title={t('footer.count')}
    >
      {currentMode !== 'none' && displayContent ? (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', fontWeight: 600, color: '#18181B', fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center' }}>
          {displayContent}
        </span>
      ) : (
        <span style={{ fontSize: '12px', color: '#78716C', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={12} />
          {t('footer.none')}
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
            className="animate-popover"
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
              {field.name}
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

