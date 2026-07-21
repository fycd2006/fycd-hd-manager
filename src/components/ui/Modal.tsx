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
    tiny: 'modal__box--tiny',
    small: 'modal__box--small',
    medium: '',
    large: 'modal__box--wide',
    full: 'modal__box--full-screen'
  }

  return (
    <div
      ref={modalRef}
      className="modal__wrapper"
      onClick={handleOutsideClick}
    >
      <div
        className={`modal__box ${sizeClassMap[size] || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="modal__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            {title && <h2 className="box__title" style={{ margin: 0 }}>{title}</h2>}
            {showCloseButton && (
              <a
                onClick={onClose}
                className="modal__close"
                style={{ cursor: 'pointer', fontSize: '18px', color: '#909399', textDecoration: 'none' }}
              >
                ✕
              </a>
            )}
          </div>
        )}
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>
  )
}
