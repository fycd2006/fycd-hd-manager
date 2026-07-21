'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

interface TableField {
  id: number
  tableId: number
  name: string
  type: string
  order: number
  options: string | null
}

type CellValue = string | number | boolean | null | CellValue[] | { [key: string]: CellValue }

interface TableRow {
  id: number
  tableId: number
  data: Record<string, CellValue>
  order: number
  createdAt: string
}

interface KanbanViewProps {
  fields: TableField[]
  rows: TableRow[]
  onUpdateCell: (rowId: number, fieldKey: string, value: CellValue) => Promise<void>
  onExpandRow: (row: TableRow) => void
}

export default function KanbanView({
  fields,
  rows,
  onUpdateCell,
  onExpandRow,
}: KanbanViewProps) {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Find all single select fields
  const singleSelectFields = fields.filter(f => f.type === 'single_select')
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(
    singleSelectFields[0]?.id || null
  )

  if (!isMounted) return null

  const activeField = fields.find(f => f.id === selectedFieldId)

  if (singleSelectFields.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <h3>沒有可用的單選欄位</h3>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          看板視圖需要至少一個「單選 (single_select)」類型的欄位來進行卡片分組。
        </p>
      </div>
    )
  }

  const parseOptionsList = (optionsRaw: any): string[] => {
    if (!optionsRaw) return []
    try {
      let parsed = typeof optionsRaw === 'string' ? JSON.parse(optionsRaw) : optionsRaw
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed) } catch {}
      }
      if (Array.isArray(parsed)) return parsed.map(String)
      if (parsed && Array.isArray(parsed.choices)) return parsed.choices.map(String)
      if (parsed && Array.isArray(parsed.select_options)) return parsed.select_options.map((o: any) => typeof o === 'object' ? o.value || o.name || String(o) : String(o))
    } catch {}
    if (typeof optionsRaw === 'string') {
      return optionsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
    }
    return []
  }

  // Get choices for the active select field
  const choicesList = parseOptionsList(activeField?.options)
  const columns = ['__unassigned__', ...choicesList]

  // Group rows
  const groupedRows: Record<string, TableRow[]> = {}
  columns.forEach(col => {
    groupedRows[col] = []
  })

  const groupKey = activeField ? `field_${activeField.id}` : ''
  rows.forEach(row => {
    const rawVal = row.data[groupKey]
    let valStr = ''
    if (Array.isArray(rawVal)) {
      valStr = String(rawVal[0] ?? '')
    } else if (rawVal && typeof rawVal === 'object') {
      valStr = String((rawVal as any).value || (rawVal as any).name || (rawVal as any).id || '')
    } else {
      valStr = String(rawVal ?? '')
    }

    if (valStr && columns.includes(valStr)) {
      groupedRows[valStr].push(row)
    } else {
      groupedRows['__unassigned__'].push(row)
    }
  })

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result

    // Dropped outside the list or no movement
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
      return
    }

    const rowId = parseInt(draggableId.replace('card-', ''))
    if (isNaN(rowId) || !activeField) return

    const newColumnValue = destination.droppableId
    const finalValue = newColumnValue === '__unassigned__' ? '' : newColumnValue
    onUpdateCell(rowId, `field_${activeField.id}`, finalValue)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', overflow: 'hidden' }}>
      {/* Select Field Selector */}
      <div style={{ padding: '12px 24px', background: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>分組欄位：</span>
        <select
          value={selectedFieldId || ''}
          onChange={e => setSelectedFieldId(Number(e.target.value))}
          style={{ width: 'auto', padding: '4px 8px', borderRadius: '6px', fontSize: '12px' }}
        >
          {singleSelectFields.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Columns Area */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '16px',
            padding: '16px 24px',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'thin',
          }}
        >
          {columns.map(col => {
            const colTitle = col === '__unassigned__' ? '未指定狀態' : col
            const colRows = groupedRows[col] || []

            return (
              <div
                key={col}
                style={{
                  width: '280px',
                  minWidth: '280px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '100%',
                  overflow: 'hidden'
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.1)'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{colTitle}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {colRows.length}
                  </span>
                </div>

                {/* Card List */}
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      style={{
                        flex: 1,
                        padding: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        overflowY: 'auto',
                        scrollbarWidth: 'thin',
                        background: snapshot.isDraggingOver ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                        transition: 'background-color 0.2s ease',
                      }}
                    >
                      {colRows.map((row, index) => {
                        // Get first text field or default value to display as title
                        const firstTextField = fields.find(f => f.type === 'text')
                        const cardTitleKey = firstTextField ? `field_${firstTextField.id}` : Object.keys(row.data)[0]
                        const cardTitle = row.data[cardTitleKey] || `列 ID: ${row.id}`

                        return (
                          <Draggable key={row.id} draggableId={`card-${row.id}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onExpandRow(row)}
                                style={{
                                  background: 'var(--bg-secondary)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '12px',
                                  cursor: 'grab',
                                  boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
                                  transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                                  ...provided.draggableProps.style,
                                }}
                                onMouseEnter={e => {
                                  if (!snapshot.isDragging) e.currentTarget.style.borderColor = 'var(--accent-primary)'
                                }}
                                onMouseLeave={e => {
                                  if (!snapshot.isDragging) e.currentTarget.style.borderColor = 'var(--border-color)'
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                  {String(cardTitle)}
                                </div>

                                {/* Display other attributes */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {fields
                                    .filter(f => f.id !== selectedFieldId && (!firstTextField || f.id !== firstTextField.id))
                                    .slice(0, 3) // Show at most 3 secondary fields
                                    .map(f => {
                                      const val = row.data[`field_${f.id}`]
                                      if (val == null || val === '') return null
                                      
                                      let displayVal = String(val)
                                      // Format object list for links
                                      if (f.type === 'link_row' && Array.isArray(val)) {
                                        displayVal = val.map(item => typeof item === 'object' ? (item as any)?.value : item).join(', ')
                                      }

                                      return (
                                        <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                          <span style={{ color: 'var(--text-muted)' }}>{f.name}</span>
                                          <span style={{ color: 'var(--text-secondary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {displayVal}
                                          </span>
                                        </div>
                                      )
                                    })}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
    </div>
  )
}
