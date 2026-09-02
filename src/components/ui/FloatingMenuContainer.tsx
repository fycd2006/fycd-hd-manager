'use client'

import React, { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import PortalWrapper from './PortalWrapper'

export interface FloatingMenuContainerProps {
  show?: boolean
  x?: number
  y?: number
  onClose: () => void
  children: React.ReactNode
  width?: number | string
  className?: string
  style?: React.CSSProperties
  zIndex?: number
}

/**
 * Reusable animated floating menu container with collision-aware positioning and AnimatePresence exit animations.
 */
export default function FloatingMenuContainer({
  show = true,
  x,
  y,
  onClose,
  children,
  width = 220,
  className,
  style,
  zIndex = 2147483640,
}: FloatingMenuContainerProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  } | null>(null)

  // ESC key handler
  useEffect(() => {
    if (!show) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, onClose])

  // Click outside and scroll handler
  useEffect(() => {
    if (!show) return
    const handleScrollOrResize = (e: Event) => {
      if (
        menuRef.current &&
        e.target &&
        menuRef.current.contains(e.target as Node)
      ) {
        return
      }
      onClose()
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [show, onClose])

  // Position calculation with viewport collision detection
  useLayoutEffect(() => {
    if (!show || x === undefined || y === undefined) {
      setAdjustedPos(null)
      return
    }

    const posX = x
    const posY = y
    const menuEl = menuRef.current
    const menuWidth = menuEl ? menuEl.offsetWidth : typeof width === 'number' ? width : 220
    const menuHeight = menuEl ? menuEl.offsetHeight : 240

    const winW = typeof window !== 'undefined' ? window.innerWidth : 1200
    const winH = typeof window !== 'undefined' ? window.innerHeight : 800

    const pos: { top?: number; bottom?: number; left?: number; right?: number } = {}

    if (posX + menuWidth > winW - 8) {
      pos.right = Math.max(8, winW - posX)
    } else {
      pos.left = Math.max(8, posX)
    }

    if (posY + menuHeight > winH - 8) {
      pos.bottom = Math.max(8, winH - posY)
    } else {
      pos.top = Math.max(8, posY)
    }

    setAdjustedPos(pos)
  }, [show, x, y, width])

  return (
    <PortalWrapper>
      <AnimatePresence>
        {show && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              backgroundColor: 'transparent',
              pointerEvents: 'auto',
            }}
            onClick={onClose}
            onContextMenu={(e) => {
              e.preventDefault()
              onClose()
            }}
          >
            <motion.div
              ref={menuRef}
              key="floating-menu-panel"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className={className}
              style={{
                position: 'fixed',
                ...(adjustedPos || { left: x, top: y }),
                width: typeof width === 'number' ? `${width}px` : width,
                backgroundColor: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRadius: '12px',
                border: '1px solid rgba(226, 232, 240, 0.85)',
                boxShadow: '0 20px 35px -10px rgba(15, 23, 42, 0.16), 0 8px 15px -6px rgba(15, 23, 42, 0.08)',
                padding: '4px',
                userSelect: 'none',
                zIndex: zIndex + 1,
                ...style,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PortalWrapper>
  )
}
