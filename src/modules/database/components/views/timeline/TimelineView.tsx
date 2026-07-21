'use client'

import React, { useState, useRef, useEffect } from 'react'

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

interface TimelineViewProps {
  fields: TableField[]
  rows: TableRow[]
  onExpandRow: (row: TableRow) => void
  onUpdateCell?: (rowId: number, fieldKey: string, value: CellValue) => void
  onAddRow?: () => void
}

export default function TimelineView({
  fields,
  rows,
  onExpandRow,
  onUpdateCell,
  onAddRow
}: TimelineViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 3, 1)) // Default to April 2025 as in screenshot
  const dateField = fields.find(f => f.type === 'date')
  const firstTextField = fields.find(f => f.type === 'text')
  
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Navigate months
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Get total days in month
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()

  const dayColumns = Array.from({ length: totalDays }, (_, i) => i + 1)
  
  // Format month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const formattedMonthStr = `${monthNames[month]} ${year}`

  // Today indicators
  const today = new Date()
  const isTodayInView = today.getFullYear() === year && today.getMonth() === month
  const todayDay = today.getDate()

  // Horizontal scroll to keep middle dates visible on load
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0
    }
  }, [currentDate])

  if (!dateField) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px', color: 'var(--text-muted)' }}>
        <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2">
            <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h8"/>
          </svg>
        </div>
        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px' }}>無法啟用時間軸視圖</h4>
        <p style={{ margin: '8px 0 0 0', fontSize: '13px', textAlign: 'center', maxWidth: '320px', lineHeight: 1.4 }}>
          此資料表中目前沒有任何「日期 (Date)」型別的欄位。請先新增一個日期欄位以便在時間軸上排程資料！
        </p>
      </div>
    )
  }

  // Pre-calculate colored bars mapping
  const activeFieldKey = `field_${dateField.id}`
  const nameFieldKey = firstTextField ? `field_${firstTextField.id}` : ''

  // Color options for tasks (cyclic)
  const taskColors = [
    { bg: 'rgba(99, 102, 241, 0.08)', border: 'rgba(99, 102, 241, 0.4)', text: 'var(--accent-secondary)' }, // Indigo
    { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.4)', text: 'var(--success)' }, // Green
    { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.4)', text: 'var(--warning)' }, // Yellow
    { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.4)', text: 'var(--danger)' }, // Red
  ]

  const [startFieldId, setStartFieldId] = useState<number | null>(dateField.id)
  const [endFieldId, setEndFieldId] = useState<number | null>(null)
  const [timescale, setTimescale] = useState<'days' | 'weeks' | 'months'>('days')

  const dateFields = fields.filter(f => f.type === 'date')
  const startField = fields.find(f => f.id === startFieldId) || dateField
  const endField = fields.find(f => f.id === endFieldId)

  // Column width based on timescale zoom level
  const colWidth = timescale === 'days' ? 50 : timescale === 'weeks' ? 120 : 200

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', overflow: 'hidden', background: 'var(--bg-primary)', position: 'relative' }}>
      {/* Timeline Toolbar Header */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '12px 24px', 
          borderBottom: '1px solid var(--border-color)', 
          background: 'var(--bg-secondary)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formattedMonthStr}
          </h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button 
              onClick={handlePrevMonth} 
              className="toolbar-btn" 
              style={{ padding: '4px 8px', fontSize: '13px' }}
            >
              &lt;
            </button>
            <button 
              onClick={handleNextMonth} 
              className="toolbar-btn" 
              style={{ padding: '4px 8px', fontSize: '13px' }}
            >
              &gt;
            </button>
          </div>
          <button 
            onClick={handleToday} 
            className="toolbar-btn" 
            style={{ padding: '4px 12px', fontSize: '12px', background: 'rgba(255,255,255,0.03)' }}
          >
            今日
          </button>
        </div>

        {/* Timescale Zoom & Date Anchor Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>檢視縮放:</span>
            <select
              value={timescale}
              onChange={e => setTimescale(e.target.value as any)}
              style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="days">日 (Days)</option>
              <option value="weeks">週 (Weeks)</option>
              <option value="months">月 (Months)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>開始日期:</span>
            <select
              value={startField.id}
              onChange={e => setStartFieldId(Number(e.target.value))}
              style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            >
              {dateFields.map(df => (
                <option key={df.id} value={df.id}>{df.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>結束日期:</span>
            <select
              value={endFieldId || ''}
              onChange={e => setEndFieldId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '3px 8px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="">（無 / 固定長度）</option>
              {dateFields.map(df => (
                <option key={df.id} value={df.id}>{df.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Side: Row Titles List */}
        <div 
          style={{ 
            width: '240px', 
            borderRight: '1px solid var(--border-color)', 
            background: 'var(--bg-secondary)', 
            overflowY: 'auto',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header spacer */}
          <div 
            style={{ 
              height: '40px', 
              borderBottom: '1px solid var(--border-color)', 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 16px', 
              fontSize: '11px', 
              fontWeight: 600, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            列記錄名稱
          </div>
          
          {rows.map((row, idx) => {
            const label = nameFieldKey ? String(row.data[nameFieldKey] || '') : ''
            const displayLabel = label.trim() || `列記錄 ID: ${row.id}`
            
            return (
              <div 
                key={row.id}
                onClick={() => onExpandRow(row)}
                style={{ 
                  height: '48px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '0 16px', 
                  borderBottom: '1px solid var(--border-color)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'background-color 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {displayLabel}
              </div>
            )
          })}
        </div>

        {/* Right Side: Horizontal Scrollable Timeline Day Tracks */}
        <div 
          ref={scrollContainerRef}
          style={{ 
            flex: 1, 
            overflowX: 'auto', 
            overflowY: 'hidden', 
            display: 'flex', 
            flexDirection: 'column',
            position: 'relative'
          }}
        >
          {/* Timeline Days Header */}
          <div 
            style={{ 
              height: '40px', 
              display: 'flex', 
              borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              width: `${totalDays * colWidth}px`
            }}
          >
            {dayColumns.map(dayNum => {
              const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString()

              return (
                <div 
                  key={dayNum}
                  style={{ 
                    width: `${colWidth}px`, 
                    height: '100%', 
                    borderRight: '1px solid var(--border-color)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent-secondary)' : 'var(--text-muted)',
                    background: isToday ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                    flexShrink: 0
                  }}
                >
                  {dayNum}
                </div>
              )
            })}
          </div>

          {/* Timeline Body Rows Grid */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              width: `${totalDays * colWidth}px`,
              position: 'relative'
            }}
          >
            {/* Grid vertical line guides overlay */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', pointerEvents: 'none', zIndex: 0 }}>
              {dayColumns.map(dayNum => {
                const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString()
                return (
                  <div 
                    key={dayNum}
                    style={{ 
                      width: `${colWidth}px`, 
                      height: '100%', 
                      borderRight: '1px solid rgba(255,255,255,0.02)', 
                      borderRightColor: isToday ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                      flexShrink: 0 
                    }}
                  />
                )
              })}
            </div>

            {/* Vertical today indicator line */}
            {isTodayInView && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(todayDay - 1) * colWidth + colWidth / 2}px`,
                  width: '2px',
                  background: 'var(--accent-secondary)',
                  opacity: 0.8,
                  zIndex: 5,
                  pointerEvents: 'none'
                }}
                title="今日"
              />
            )}

            {/* Task Row Tracks */}
            {rows.map((row, idx) => {
              const startDateVal = row.data[`field_${startField.id}`]
              const endDateVal = endField ? row.data[`field_${endField.id}`] : null

              let dayStart: number | null = null
              let barSpanDays = 3

              if (startDateVal) {
                const parsedStart = new Date(String(startDateVal))
                if (!isNaN(parsedStart.getTime()) && parsedStart.getFullYear() === year && parsedStart.getMonth() === month) {
                  dayStart = parsedStart.getDate()
                  if (endDateVal) {
                    const parsedEnd = new Date(String(endDateVal))
                    if (!isNaN(parsedEnd.getTime())) {
                      const diffDays = Math.ceil((parsedEnd.getTime() - parsedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                      if (diffDays > 0) {
                        barSpanDays = diffDays
                      }
                    }
                  }
                }
              }

              const taskColor = taskColors[idx % taskColors.length]
              const label = nameFieldKey ? String(row.data[nameFieldKey] || '') : ''
              const displayLabel = label.trim() || `列記錄 ID: ${row.id}`

              return (
                <div 
                  key={row.id}
                  style={{ 
                    height: '48px', 
                    position: 'relative', 
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 1,
                    width: '100%'
                  }}
                >
                  {/* Grid interactive cells that can be double clicked to re-schedule */}
                  {dayColumns.map(dayNum => {
                    const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                    return (
                      <div
                        key={dayNum}
                        onDoubleClick={() => {
                          if (onUpdateCell) {
                            onUpdateCell(row.id, activeFieldKey, cellDateStr)
                          }
                        }}
                        style={{
                          width: `${colWidth}px`,
                          height: '100%',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                        title="雙擊此處可在此日期重新排程此項目"
                      />
                    )
                  })}

                  {/* Task Bar rendered absolutely on top of cells */}
                  {dayStart !== null && (
                    <div 
                      onClick={() => onExpandRow(row)}
                      style={{
                        position: 'absolute',
                        left: `${(dayStart - 1) * colWidth + 6}px`,
                        width: `${barSpanDays * colWidth - 12}px`,
                        height: '32px',
                        background: taskColor.bg,
                        border: `1px solid ${taskColor.border}`,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: taskColor.text,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        zIndex: 2,
                        pointerEvents: 'auto'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.02)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none'
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
                      }}
                      title={`${displayLabel} (雙擊網格其他位置重新排程 | 日期: ${startDateVal || ''})`}
                    >
                      {displayLabel}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Floating Add Row button matching Baserow Timeline view */}
      {onAddRow && (
        <button
          onClick={onAddRow}
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--accent-gradient)',
            color: 'white',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            cursor: 'pointer',
            zIndex: 100,
            transition: 'transform 0.15s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          title="新增列記錄"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <line x1="12" x2="12" y1="5" y2="19"/>
            <line x1="5" x2="19" y1="12" y2="12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
