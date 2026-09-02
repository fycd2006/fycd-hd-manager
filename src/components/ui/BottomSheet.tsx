'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'motion/react'
import PortalWrapper from './PortalWrapper'

export interface BottomSheetProps {
  show: boolean
  onClose: () => void
  children: React.ReactNode
  title?: React.ReactNode
  maxHeight?: string | number
  zIndex?: number
  isDark?: boolean
  className?: string
  style?: React.CSSProperties
  bottomOffset?: string
  dragDismiss?: boolean
}

/**
 * Mobile-first BottomSheet with spring motion, drag-down to dismiss gesture, and safe-area insets.
 */
export default function BottomSheet({
  show,
  onClose,
  children,
  title,
  maxHeight = '85vh',
  zIndex = 1050,
  isDark = false,
  className = '',
  style,
  bottomOffset,
  dragDismiss = true,
}: BottomSheetProps) {
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

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 80 || info.velocity.y > 400) {
      onClose()
    }
  }

  return (
    <PortalWrapper>
      <AnimatePresence>
        {show && (
          <motion.div
            key="bottom-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: bottomOffset || 0,
              zIndex,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pointerEvents: 'auto',
              touchAction: 'manipulation',
            }}
            onClick={onClose}
          >
            <motion.div
              key="bottom-sheet-content"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              drag={dragDismiss ? 'y' : false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.3 }}
              onDragEnd={handleDragEnd}
              style={{
                width: '100vw',
                maxWidth: '100vw',
                maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
                borderBottom: 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
                zIndex: zIndex + 1,
                ...style,
              }}
              className={className}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              {/* Drag Handle Bar */}
              <div
                style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: '9999px',
                  backgroundColor: isDark ? '#334155' : '#cbd5e1',
                  margin: '10px auto 4px auto',
                  flexShrink: 0,
                  cursor: 'grab',
                }}
              />

              {title && (
                <div
                  style={{
                    padding: '8px 20px 12px 20px',
                    borderBottom: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {typeof title === 'string' ? (
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: isDark ? '#f8fafc' : '#0f172a',
                      }}
                    >
                      {title}
                    </span>
                  ) : (
                    title
                  )}
                </div>
              )}

              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PortalWrapper>
  )
}
