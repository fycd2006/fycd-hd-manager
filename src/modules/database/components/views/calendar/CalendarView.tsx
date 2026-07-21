'use client'

import React, { useState } from 'react'

interface TableField {
  id: number
  name: string
  type: string
}

type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

interface TableRow {
  id: number
  data: Record<string, CellValue>
  order: number
}

interface CalendarViewProps {
  fields: TableField[]
  rows: TableRow[]
  onExpandRow: (row: TableRow) => void
}

export default function CalendarView({ fields, rows, onExpandRow }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Find all date fields
  const dateFields = fields.filter(f => f.type === 'date')
  const [selectedDateFieldId, setSelectedDateFieldId] = useState<number | null>(
    dateFields.length > 0 ? dateFields[0].id : null
  )

  // Expanded day modal state
  const [expandedDate, setExpandedDate] = useState<{ dateStr: string; rows: TableRow[] } | null>(null)

  const activeDateField = dateFields.find(f => f.id === selectedDateFieldId) || dateFields[0]

  if (!activeDateField) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px', color: 'var(--text-muted)' }}>
        <div style={{ width: '48px', height: '48px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
            <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
          </svg>
        </div>
        <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>無法啟用日曆視圖</h4>
        <p style={{ margin: '8px 0 0 0', fontSize: '13px', textAlign: 'center', maxWidth: '320px', lineHeight: 1.4 }}>
          此資料表中目前沒有任何「日期 (Date)」型別的欄位。請先新增一個日期欄位以便將資料投射在日曆上！
        </p>
      </div>
    )
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first day of the month
  const firstDayIndex = new Date(year, month, 1).getDay()
  
  // Get total days in month
  const totalDays = new Date(year, month + 1, 0).getDate()
  
  // Get total days in previous month
  const prevTotalDays = new Date(year, month, 0).getDate()

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = []

  // Fill previous month overflow days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevTotalDays - i
    const m = month === 0 ? 11 : month - 1
    const y = month === 0 ? year - 1 : year
    days.push({
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      dayNum: day,
      isCurrentMonth: false
    })
  }

  // Fill current month days
  for (let i = 1; i <= totalDays; i++) {
    days.push({
      dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      dayNum: i,
      isCurrentMonth: true
    })
  }

  // Fill next month overflow days to complete grid
  const remainingCells = days.length % 7 === 0 ? 0 : 7 - (days.length % 7)
  for (let i = 1; i <= remainingCells; i++) {
    const m = month === 11 ? 0 : month + 1
    const y = month === 11 ? year + 1 : year
    days.push({
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
      dayNum: i,
      isCurrentMonth: false
    })
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Group rows by active date field value
  const rowsByDate: Record<string, TableRow[]> = {}
  rows.forEach(row => {
    const val = row.data[`field_${activeDateField.id}`]
    if (val) {
      const dStr = String(val).split('T')[0]
      if (!rowsByDate[dStr]) rowsByDate[dStr] = []
      rowsByDate[dStr].push(row)
    }
  })

  const weekdayNames = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', minHeight: 0, position: 'relative' }}>
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
            {year} 年 {month + 1} 月
          </h3>

          {/* Date Field Anchor Switcher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>基準日期欄位：</span>
            <select
              value={activeDateField.id}
              onChange={e => setSelectedDateFieldId(Number(e.target.value))}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {dateFields.map(df => (
                <option key={df.id} value={df.id}>{df.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="toolbar-btn" onClick={handleToday} style={{ padding: '4px 10px', fontSize: '11px' }}>
            今天
          </button>
          <button className="toolbar-btn" onClick={handlePrevMonth} style={{ padding: '4px 8px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button className="toolbar-btn" onClick={handleNextMonth} style={{ padding: '4px 8px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday Titles Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
        {weekdayNames.map((name, idx) => (
          <div key={idx} style={{ textAlign: 'center', padding: '8px 0', fontSize: '11px', fontWeight: 600, color: idx === 0 || idx === 6 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            {name}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', flex: 1, minHeight: 0, overflow: 'hidden', background: 'var(--border-color)', gap: '1px' }}>
        {days.map((day, idx) => {
          const dayRows = rowsByDate[day.dateStr] || []
          const isToday = new Date().toISOString().split('T')[0] === day.dateStr
          const MAX_VISIBLE_CARDS = 2
          const visibleRows = dayRows.slice(0, MAX_VISIBLE_CARDS)
          const overflowCount = dayRows.length - MAX_VISIBLE_CARDS

          return (
            <div
              key={idx}
              style={{
                background: day.isCurrentMonth ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              {/* Day Number Label */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: isToday ? 700 : 500,
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isToday ? 'var(--accent-gradient)' : 'transparent',
                    color: isToday ? 'white' : day.isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)'
                  }}
                >
                  {day.dayNum}
                </span>
                {dayRows.length > 0 && (
                  <span style={{ fontSize: '9px', color: 'var(--accent-secondary)', fontWeight: 600 }}>{dayRows.length} 筆</span>
                )}
              </div>

              {/* Cards Container with Overcrowding support */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '2px' }}>
                {visibleRows.map(row => {
                  const firstKey = Object.keys(row.data)[0]
                  const title = String(row.data[firstKey] || `列 ID: ${row.id}`)

                  return (
                    <div
                      key={row.id}
                      onClick={() => onExpandRow(row)}
                      style={{
                        padding: '4px 8px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'transform 0.1s, background 0.1s'
                      }}
                      title={title}
                    >
                      {title}
                    </div>
                  )
                })}

                {/* Overcrowding "+X more" Popover trigger */}
                {overflowCount > 0 && (
                  <button
                    onClick={() => setExpandedDate({ dateStr: day.dateStr, rows: dayRows })}
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px dashed var(--accent-color)',
                      color: 'var(--accent-color)',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 4px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    +{overflowCount} 筆更多...
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Expanded Date Modal Popover for overcrowded days */}
      {expandedDate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '360px', maxHeight: '480px', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)' }}>{expandedDate.dateStr} 所有項目 ({expandedDate.rows.length})</h4>
              <button onClick={() => setExpandedDate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {expandedDate.rows.map(row => {
                const firstKey = Object.keys(row.data)[0]
                const title = String(row.data[firstKey] || `列 ID: ${row.id}`)
                return (
                  <div
                    key={row.id}
                    onClick={() => {
                      onExpandRow(row)
                      setExpandedDate(null)
                    }}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    {title}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

