'use client'

import React from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  isDivider?: boolean
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  title?: string
}

export default function ContextMenu({ items, title }: ContextMenuProps) {
  return (
    <div className="context__menu">
      {title && <div className="context__menu-title">{title}</div>}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.isDivider ? (
            <div className="context__menu-divider" />
          ) : (
            <button
              className={`context__menu-item ${item.danger ? 'context__menu-item--danger' : ''}`}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.icon && <span className="context__menu-item-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
