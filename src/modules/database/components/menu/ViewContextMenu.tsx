'use client'

import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  Upload, 
  Download, 
  Copy, 
  Pencil, 
  Trash2,
  UploadCloud
} from 'lucide-react'
import type { TableView } from '@/modules/database/types'

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
  const menuRef = useRef<HTMLDivElement>(null)

  const viewTypeMap: Record<string, string> = {
    grid: '表格視圖',
    kanban: '看板視圖',
    gallery: '畫廊視圖',
    calendar: '日曆視圖',
    timeline: '時間軸視圖',
    form: '表單視圖'
  }

  const viewTypeLabel = viewTypeMap[view.type || 'grid'] || '視圖'

  const menuItems = [
    ...(onRenameView ? [{
      id: 'rename',
      label: '重命名視圖',
      icon: Pencil,
      onClick: () => {
        onRenameView()
        onClose()
      }
    }] : []),
    ...(onDuplicateView ? [{
      id: 'duplicate',
      label: '複製視圖',
      icon: Copy,
      onClick: () => {
        onDuplicateView()
        onClose()
      }
    }] : []),
    ...(onExportView ? [{
      id: 'export',
      label: '匯出 CSV 資料',
      icon: Upload,
      onClick: () => {
        onExportView()
        onClose()
      }
    }] : []),
    ...(onImportFile ? [{
      id: 'import',
      label: '匯入 CSV 資料',
      icon: Download,
      onClick: () => {
        onImportFile()
        onClose()
      }
    }] : []),

    ...(onDeleteView ? [{
      id: 'delete',
      label: '刪除視圖',
      icon: Trash2,
      danger: true,
      onClick: () => {
        onDeleteView()
        onClose()
      }
    }] : []),
  ]

  const style: React.CSSProperties = x !== undefined && y !== undefined ? {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    zIndex: 99999999,
  } : {
    position: 'fixed',
    top: '60px',
    left: '16px',
    zIndex: 99999999,
  }

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999998,
        backgroundColor: 'transparent',
        pointerEvents: 'auto'
      }}
      onClick={onClose}
    >
      <div
        ref={menuRef}
        style={{
          ...style,
          width: '200px',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(0,0,0,0.06)',
          padding: '6px 0',
          userSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '8px 14px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#64748b',
            borderBottom: '1px solid #f1f5f9',
            marginBottom: '4px',
          }}
        >
          {view.name || viewTypeLabel}
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
                <Icon size={15} style={{ color: item.danger ? '#dc2626' : '#64748b', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}
