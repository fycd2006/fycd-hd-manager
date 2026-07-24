'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ChevronRight } from 'lucide-react'
import type { TableField, TableRow } from '@/modules/database/types'

interface MobileSearchModalProps {
  show: boolean
  onClose: () => void
  fields: TableField[]
  rows: TableRow[]
  onSelectRow?: (row: TableRow) => void
}

export default function MobileSearchModal({
  show,
  onClose,
  fields = [],
  rows = [],
  onSelectRow
}: MobileSearchModalProps) {
  const [mounted, setMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || rows.length === 0) return []
    const term = searchTerm.toLowerCase().trim()
    return rows.filter(row => {
      return Object.values(row.data || {}).some(val => {
        if (val === null || val === undefined) return false
        return String(val).toLowerCase().includes(term)
      })
    }).slice(0, 30)
  }, [rows, searchTerm])

  if (!show || !mounted) return null

  // Get primary text for a row
  const getRowTitle = (row: TableRow) => {
    const firstTextField = fields.find(f => f.type === 'text') || fields[0]
    if (firstTextField && row.data?.[firstTextField.name]) {
      return String(row.data[firstTextField.name])
    }
    const anyVal = Object.values(row.data || {}).find(v => v !== null && v !== '')
    return anyVal ? String(anyVal) : `紀錄 #${row.id}`
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'auto',
        touchAction: 'manipulation'
      }}
      onClick={onClose}
    >
      {/* Soft Borderless Elevated Card */}
      <div
        style={{
          width: '500px',
          maxWidth: '92vw',
          maxHeight: '80vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.22)',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="搜尋紀錄"
      >
        {/* Header - Borderless Spacing */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 12px 24px',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={18} color="#2563eb" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              搜尋紀錄
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f1f5f9',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              borderRadius: '9999px',
              transition: 'transform 0.15s ease'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px 24px' }}>
          {/* Search Input Box - Borderless Soft Surface */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search
              size={16}
              color="#94a3b8"
              style={{ position: 'absolute', left: '14px', top: '13px' }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="輸入關鍵字搜尋紀錄..."
              autoFocus
              style={{
                width: '100%',
                backgroundColor: '#f1f5f9',
                color: '#0f172a',
                paddingLeft: '42px',
                paddingRight: '36px',
                paddingTop: '11px',
                paddingBottom: '11px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '12px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Search Results List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {searchTerm.trim() ? (
              searchResults.length > 0 ? (
                searchResults.map(row => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      if (onSelectRow) {
                        onSelectRow(row)
                      }
                      onClose()
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      backgroundColor: '#f8fafc',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div
                        style={{
                          padding: '4px 9px',
                          borderRadius: '8px',
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          fontWeight: 700,
                          fontSize: '12px',
                          flexShrink: 0
                        }}
                      >
                        #{row.id}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getRowTitle(row)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {Object.entries(row.data || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .slice(0, 3)
                            .join(' • ')}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                  </button>
                ))
              ) : (
                <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                  找不到包含「{searchTerm}」的紀錄
                </div>
              )
            ) : (
              <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                請輸入關鍵字開始搜尋紀錄
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
