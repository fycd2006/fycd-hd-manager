'use client'

import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

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
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && show) {
        onClose()
      }
    }

    if (show) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleEscape)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleEscape)
    }
  }, [show, closeOnEscape, onClose])

  if (!show) return null

  const handleOutsideClick = (e: React.MouseEvent) => {
    if (closeOnOutsideClick && e.target === modalRef.current) {
      onClose()
    }
  }

  const sizeWidthMap = {
    tiny: '360px',
    small: '480px',
    medium: '600px',
    large: '760px',
    full: '960px'
  }

  return (
    <div
      ref={modalRef}
      className="modal-overlay animate-in fade-in duration-200"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxSizing: 'border-box'
      }}
      onClick={handleOutsideClick}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl shadow-slate-950/20 transition-all duration-200 animate-in fade-in zoom-in-95"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: sizeWidthMap[size] || '480px',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflow: overflowVisible ? 'visible' : 'hidden',
          borderRadius: '20px',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '28px', boxSizing: 'border-box' }}
        >
          {(title || showCloseButton) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                paddingBottom: '16px',
                marginBottom: '20px',
                borderBottom: '1px solid #f1f5f9',
                boxSizing: 'border-box'
              }}
            >
              {title && (
                <h2
                  style={{
                    margin: 0,
                    padding: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#0f172a',
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
                    color: '#94a3b8',
                    marginLeft: 'auto',
                    transition: 'all 0.15s ease'
                  }}
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
    </div>
  )
}

