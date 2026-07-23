'use client'

import React, { useRef } from 'react'
import { 
  Clock, 
  Upload, 
  Download, 
  Copy, 
  User, 
  Globe, 
  Settings, 
  Pencil, 
  Trash2 
} from 'lucide-react'
import type { TableView } from '@/modules/database/types'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'

interface ViewContextMenuProps {
  view: TableView
  x?: number
  y?: number
  onClose: () => void
  onConfigureDateDependencies?: () => void
  onExportView?: () => void
  onImportFile?: () => void
  onDuplicateView?: () => void
  onToPersonal?: () => void
  onWebhooks?: () => void
  onDefaultRowValues?: () => void
  onRenameView?: () => void
  onDeleteView?: () => void
}

export function ViewContextMenu({
  view,
  x,
  y,
  onClose,
  onConfigureDateDependencies,
  onExportView,
  onImportFile,
  onDuplicateView,
  onToPersonal,
  onWebhooks,
  onDefaultRowValues,
  onRenameView,
  onDeleteView,
}: ViewContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(menuRef, onClose)

  const viewTypeLabel = view.type ? view.type.charAt(0).toUpperCase() + view.type.slice(1) : 'Grid'

  const menuItems = [
    {
      id: 'date-deps',
      label: 'Configure date dependencies',
      icon: Clock,
      onClick: () => {
        onConfigureDateDependencies?.()
        onClose()
      }
    },
    {
      id: 'export',
      label: 'Export view',
      icon: Upload,
      onClick: () => {
        onExportView?.()
        onClose()
      }
    },
    {
      id: 'import',
      label: 'Import file',
      icon: Download,
      onClick: () => {
        onImportFile?.()
        onClose()
      }
    },
    {
      id: 'duplicate',
      label: 'Duplicate view',
      icon: Copy,
      onClick: () => {
        onDuplicateView?.()
        onClose()
      }
    },
    {
      id: 'personal',
      label: 'To personal',
      icon: User,
      onClick: () => {
        onToPersonal?.()
        onClose()
      }
    },
    {
      id: 'webhooks',
      label: 'Webhooks',
      icon: Globe,
      onClick: () => {
        onWebhooks?.()
        onClose()
      }
    },
    {
      id: 'default-values',
      label: 'Default row values',
      icon: Settings,
      onClick: () => {
        onDefaultRowValues?.()
        onClose()
      }
    },
    {
      id: 'rename',
      label: 'Rename view',
      icon: Pencil,
      onClick: () => {
        onRenameView?.()
        onClose()
      }
    },
    {
      id: 'delete',
      label: 'Delete view',
      icon: Trash2,
      danger: true,
      onClick: () => {
        onDeleteView?.()
        onClose()
      }
    },
  ]

  const style: React.CSSProperties = x !== undefined && y !== undefined ? {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 999999,
  } : {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    zIndex: 99999,
  }

  return (
    <div
      ref={menuRef}
      style={{
        ...style,
        width: '240px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
        padding: '6px 0',
        userSelect: 'none',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 14px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#475569',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '4px',
        }}
      >
        {viewTypeLabel} ({view.id})
      </div>

      {/* Menu List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.id}
              onClick={item.onClick}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 14px',
                fontSize: '13px',
                color: item.danger ? '#dc2626' : '#334155',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = item.danger ? '#fef2f2' : '#f8fafc'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Icon size={16} style={{ color: item.danger ? '#dc2626' : '#64748b', flexShrink: 0 }} />
              <span style={{ fontWeight: 400 }}>{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
