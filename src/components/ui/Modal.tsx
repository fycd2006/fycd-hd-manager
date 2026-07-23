'use client'

import React, { useEffect, useRef } from 'react'

interface ModalProps {
  show: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'small' | 'medium' | 'large' | 'full' | 'tiny'
  closeOnOutsideClick?: boolean
  closeOnEscape?: boolean
  showCloseButton?: boolean
  fullHeight?: boolean
  contentScrollable?: boolean
  noPadding?: boolean
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

  const sizeClassMap = {
    tiny: 'modal-box--tiny',
    small: 'modal-box--small',
    medium: 'modal-box--medium',
    large: 'modal-box--large',
    full: 'modal-box--full'
  }

  return (
    <div
      ref={modalRef}
      className="modal-overlay visible"
      onClick={handleOutsideClick}
    >
      <div
        className={`modal-box ${sizeClassMap[size] || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            )}
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
