'use client'

import React, { useRef, useState } from 'react'
import Context from './Context'
import ContextMenu from './ContextMenu'

interface TableContextMenuProps {
  show: boolean
  onClose: () => void
  targetRef: React.RefObject<HTMLElement>
  tableName: string
  tableId: number
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export default function TableContextMenu({
  show,
  onClose,
  targetRef,
  tableName,
  tableId,
  onRename,
  onDuplicate,
  onDelete
}: TableContextMenuProps) {
  const menuItems = [
    {
      label: tableName,
      icon: null,
      onClick: () => {},
      disabled: true
    },
    { label: '', isDivider: true },
    {
      label: '重新命名',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
      onClick: () => {
        onRename()
        onClose()
      }
    },
    {
      label: '複製表格',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      ),
      onClick: () => {
        onDuplicate()
        onClose()
      }
    },
    { label: '', isDivider: true },
    {
      label: '刪除表格',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      ),
      onClick: () => {
        onDelete()
        onClose()
      },
      danger: true
    }
  ]

  return (
    <Context show={show} onClose={onClose} targetRef={targetRef}>
      <ContextMenu items={menuItems} />
    </Context>
  )
}
