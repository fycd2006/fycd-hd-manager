'use client'

import React, { useCallback, useRef } from 'react'
import PortalWrapper from './PortalWrapper'

interface PopoverPortalProps {
  show: boolean
  onClose: () => void
  children: React.ReactNode
  position: { top: number; left: number; width?: number } | null
  zIndex?: number
  /** Extra inline styles for the positioned container */
  style?: React.CSSProperties
}

/**
 * Unified positioned popover portal.
 *
 * Renders:
 * 1. An invisible full-screen backdrop that catches click-outside → calls onClose
 * 2. A positioned container at the given {top, left, width}
 *
 * Both layers handle onMouseDown + onTouchStart + onClick stopPropagation.
 */
export default function PopoverPortal({
  show,
  onClose,
  children,
  position,
  zIndex = 999999,
  style,
}: PopoverPortalProps) {
  if (!show || !position) return null

  return (
    <PortalWrapper>
      {/* Invisible backdrop — click to close */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: zIndex - 1 }}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
          onClose()
        }}
      />
      {/* Positioned container */}
      <div
        className="animate-popover"
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          minWidth: position.width ?? 220,
          zIndex,
          ...style,
        }}
      >
        {children}
      </div>
    </PortalWrapper>
  )
}
