'use client'

import React from 'react'
import { createPortal } from 'react-dom'

interface PortalWrapperProps {
  children: React.ReactNode
}

/**
 * Minimal Portal wrapper.
 * - SSR-safe (checks `typeof document`)
 * - Renders children into `document.body` via `createPortal`
 * - Marks the root with `data-portal-root="true"` for `useOnClickOutside` exclusion
 */
export default function PortalWrapper({ children }: PortalWrapperProps) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div data-portal-root="true">
      {children}
    </div>,
    document.body
  )
}
