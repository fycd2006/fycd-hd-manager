'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import PortalWrapper from './PortalWrapper'

interface ModalOverlayProps {
  show: boolean
  onClose: () => void
  children: React.ReactNode
  zIndex?: number
  blur?: boolean
  lockScroll?: boolean
  closeOnEscape?: boolean
  closeOnBackdrop?: boolean
  /** Extra className for the backdrop div */
  className?: string
  /** Extra inline styles for the backdrop div */
  style?: React.CSSProperties
}

/**
 * Unified full-screen modal overlay with Animate UI / Motion physics.
 *
 * Handles ALL event propagation boilerplate:
 * - Backdrop: onMouseDown + onTouchStart + onClick (mousedown→click pattern to prevent drag-close)
 * - Inner card: stopPropagation on onMouseDown, onTouchStart, onPointerDown, onClick
 * - ESC key close
 * - Optional body scroll lock
 * - Smooth AnimatePresence exit animations
 */
export default function ModalOverlay({
  show,
  onClose,
  children,
  zIndex = 999999,
  blur = true,
  lockScroll = true,
  closeOnEscape = true,
  closeOnBackdrop = true,
  className,
  style,
}: ModalOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const mousedownOnBackdropRef = useRef<boolean>(false)

  // ESC key handler
  useEffect(() => {
    if (!show || !closeOnEscape) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [show, closeOnEscape, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!show || !lockScroll) return

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [show, lockScroll])

  const handleBackdropMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    mousedownOnBackdropRef.current = e.target === overlayRef.current
  }, [])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === overlayRef.current && mousedownOnBackdropRef.current) {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
      mousedownOnBackdropRef.current = false
    },
    [closeOnBackdrop, onClose]
  )

  return (
    <PortalWrapper>
      <AnimatePresence>
        {show && (
          <motion.div
            key="modal-overlay-backdrop"
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={className}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: blur ? 'blur(4px)' : undefined,
              WebkitBackdropFilter: blur ? 'blur(4px)' : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              ...style,
            }}
            onMouseDown={handleBackdropMouseDown}
            onTouchStart={handleBackdropMouseDown as any}
            onClick={handleBackdropClick}
          >
            {/* Inner card — blocks all event propagation */}
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'contents' }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PortalWrapper>
  )
}
