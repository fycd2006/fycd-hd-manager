'use client'

import React from 'react'
import { 
  Upload, 
  Download, 
  Copy, 
  Pencil, 
  Trash2,
  UploadCloud
} from 'lucide-react'
import type { TableView } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'
import FloatingMenuContainer from '@/components/ui/FloatingMenuContainer'

interface ViewContextMenuProps {
  view: TableView
  x?: number
  y?: number
  onClose: () => void
  onExportView?: () => void
  onImportFile?: () => void
  onDuplicateView?: () => void
  onRenameView?: () => void
  onDeleteView?: () => void
}

export function ViewContextMenu({
  view,
  x,
  y,
  onClose,
  onExportView,
  onImportFile,
  onDuplicateView,
  onRenameView,
  onDeleteView,
}: ViewContextMenuProps) {
  const { t } = useI18n()

  const viewTypeLabel = t(`viewContextMenu.${view.type || 'grid'}` as any)

  const menuItems = [
    ...(onRenameView ? [{
      id: 'rename',
      label: t('viewContextMenu.rename'),
      icon: Pencil,
      onClick: () => {
        onRenameView()
        onClose()
      }
    }] : []),
    ...(onDuplicateView ? [{
      id: 'duplicate',
      label: t('viewContextMenu.duplicate'),
      icon: Copy,
      onClick: () => {
        onDuplicateView()
        onClose()
      }
    }] : []),
    ...(onExportView ? [{
      id: 'export',
      label: t('viewContextMenu.exportCsv'),
      icon: Upload,
      onClick: () => {
        onExportView()
        onClose()
      }
    }] : []),
    ...(onImportFile ? [{
      id: 'import',
      label: t('viewContextMenu.importCsv'),
      icon: Download,
      onClick: () => {
        onImportFile()
        onClose()
      }
    }] : []),
    {
      id: 'import-airtable',
      label: t('viewContextMenu.importAirtable'),
      icon: UploadCloud,
      onClick: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('open-airtable-import-modal'))
        }
        onClose()
      }
    },
    ...(onDeleteView ? [{
      id: 'delete',
      label: t('viewContextMenu.delete'),
      icon: Trash2,
      danger: true,
      onClick: () => {
        onDeleteView()
        onClose()
      }
    }] : []),
  ]

  return (
    <FloatingMenuContainer x={x ?? 16} y={y ?? 60} onClose={onClose} width={210}>
      {/* Header */}
      <div
        style={{
          padding: '8px 10px 6px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '4px',
        }}
      >
        {view.name || viewTypeLabel}
      </div>

      {/* Menu List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                padding: '7px 10px',
                borderRadius: '6px',
                fontSize: '13px',
                color: item.danger ? '#ef4444' : '#334155',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = item.danger ? '#fef2f2' : '#f1f5f9'
                if (!item.danger) e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = item.danger ? '#ef4444' : '#334155'
              }}
            >
              <Icon size={15} style={{ color: item.danger ? '#ef4444' : '#64748b', strokeWidth: 1.75, flexShrink: 0 }} />
              <span style={{ fontWeight: 500 }}>{item.label}</span>
            </div>
          )
        })}
      </div>
    </FloatingMenuContainer>
  )
}
