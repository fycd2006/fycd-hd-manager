'use client'

import React, { useState, useEffect } from 'react'

export interface CollaboratorUser {
  id: number
  username: string
  role?: string
}

interface CollaboratorSelectorProps {
  fieldKey: string
  fieldName: string
  value: any
  onChange: (fieldKey: string, nextValue: any) => void
  readOnly?: boolean
}

export const CollaboratorSelector: React.FC<CollaboratorSelectorProps> = ({
  fieldKey,
  fieldName,
  value,
  onChange,
  readOnly = false,
}) => {
  const [users, setUsers] = useState<CollaboratorUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/users')
        if (res.ok) {
          const data = await res.json()
          setUsers(Array.isArray(data) ? data : [])
        }
      } catch (e) {
        console.error('Failed to fetch users for collaborator selector:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  // Parse currently selected user IDs
  const parseSelectedIds = (val: any): number[] => {
    if (Array.isArray(val)) {
      return val.flatMap(item => {
        if (typeof item === 'number' && !isNaN(item)) return [item]
        if (typeof item === 'object' && item !== null && 'id' in item) {
          const idNum = Number((item as any).id)
          return isNaN(idNum) ? [] : [idNum]
        }
        if (typeof item === 'string') {
          const num = Number(item)
          return isNaN(num) ? [] : [num]
        }
        return []
      })
    }
    if (typeof val === 'number') return [val]
    if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parseSelectedIds(parsed)
      } catch {}
      return val.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n))
    }
    return []
  }

  const selectedIds = parseSelectedIds(value)

  const toggleUser = (userId: number) => {
    if (readOnly) return
    const isSelected = selectedIds.includes(userId)
    const nextIds = isSelected
      ? selectedIds.filter(id => id !== userId)
      : [...selectedIds, userId]

    // Formatted value matching backend expectation (list of { id, username } or IDs)
    const nextFormatted = nextIds.map(id => {
      const u = users.find(user => user.id === id)
      return { id, username: u?.username || `用戶 ID: ${id}` }
    })

    onChange(fieldKey, nextFormatted)
  }

  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>選擇指派協作者 ({fieldName})：</span>
        {loading && <span style={{ fontSize: '11px', color: '#94a3b8' }}>載入成員中...</span>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
        {users.length === 0 && !loading ? (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>無可用系統成員</span>
        ) : (
          users.map(user => {
            const isSelected = selectedIds.includes(user.id)
            return (
              <label
                key={user.id}
                onClick={() => toggleUser(user.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  cursor: readOnly ? 'default' : 'pointer',
                  background: isSelected ? '#e0e7ff' : '#ffffff',
                  border: `1px solid ${isSelected ? '#6366f1' : '#cbd5e1'}`,
                  padding: '4px 10px',
                  borderRadius: '16px',
                  userSelect: 'none',
                  color: isSelected ? '#4338ca' : '#475569',
                  fontWeight: isSelected ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{user.username}</span>
                {isSelected && (
                  <span style={{ fontSize: '10px', marginLeft: '2px', color: '#4338ca' }}>✓</span>
                )}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CollaboratorSelector
