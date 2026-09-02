'use client'

import React, { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import { Search, X, ChevronRight } from 'lucide-react'
import ModalOverlay from '@/components/ui/ModalOverlay'
import type { TableField, TableRow } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'

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
  onSelectRow,
}: MobileSearchModalProps) {
  const { t } = useI18n()
  const [searchTerm, setSearchTerm] = useState('')

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || rows.length === 0) return []
    const term = searchTerm.toLowerCase().trim()
    return rows
      .filter((row) => {
        return Object.values(row.data || {}).some((val) => {
          if (val === null || val === undefined) return false
          return String(val).toLowerCase().includes(term)
        })
      })
      .slice(0, 30)
  }, [rows, searchTerm])

  // Get primary text for a row
  const getRowTitle = (row: TableRow) => {
    const firstTextField = fields.find((f) => f.type === 'text') || fields[0]
    if (firstTextField && row.data?.[firstTextField.name]) {
      return String(row.data[firstTextField.name])
    }
    const anyVal = Object.values(row.data || {}).find((v) => v !== null && v !== '')
    return anyVal ? String(anyVal) : `#${row.id}`
  }

  return (
    <ModalOverlay show={show} onClose={onClose} closeOnBackdrop closeOnEscape zIndex={1050}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
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
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={t('mobileNav.searchRecords')}
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
            <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: '#F4F4F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={18} color="#3F6212" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
              {t('mobileNav.searchRecords')}
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
              placeholder={t('mobileNav.searchRecordsPlaceholder')}
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
                          backgroundColor: '#F4F4F5',
                          color: '#18181B',
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
                  {t('mobileNav.noSearchMatch')}
                </div>
              )
            ) : (
              <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                {t('mobileNav.enterKeywordToSearch')}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </ModalOverlay>
  )
}
