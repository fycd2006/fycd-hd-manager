'use client'

import React from 'react'
import { X } from 'lucide-react'
import ModalOverlay from './ModalOverlay'

interface ModalProps {
  show: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'full'
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  fullHeight?: boolean
  contentScrollable?: boolean
  noPadding?: boolean
  overflowVisible?: boolean
}

export default function Modal({
  show,
  onClose,
  title,
  children,
  size = 'small',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  overflowVisible = false,
}: ModalProps) {
  if (!show) return null

  const sizeWidthMap = {
    tiny: '360px',
    small: '480px',
    medium: '600px',
    large: '760px',
    full: '960px'
  }

  return (
    <ModalOverlay
      show={show}
      onClose={onClose}
      closeOnBackdrop={closeOnOutsideClick}
      closeOnEscape={closeOnEscape}
      className="animate-in fade-in duration-200"
      style={{
        zIndex: 99999,
        padding: '20px',
        backgroundColor: 'rgba(24, 24, 27, 0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 transition-all duration-200 animate-in fade-in zoom-in-95"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: sizeWidthMap[size] || '480px',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflow: overflowVisible ? 'visible' : 'hidden',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(228, 228, 231, 0.9)',
          animation: 'scaleUpModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '24px 28px', boxSizing: 'border-box' }}
        >
          {(title || showCloseButton) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingBottom: '14px',
                marginBottom: '18px',
                borderBottom: '1px solid #E4E4E7',
                boxSizing: 'border-box'
              }}
            >
              {title && (
                <h2
                  style={{
                    margin: 0,
                    padding: 0,
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#18181B',
                    whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#71717A',
                    marginLeft: 'auto',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F4F4F5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
          <div
            style={{ display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box' }}
          >
            {children}
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}
