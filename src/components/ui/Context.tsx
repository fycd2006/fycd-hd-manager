'use client'

import React, { useEffect, useRef, useState } from 'react'

interface ContextProps {
  show: boolean
  onClose: () => void
  children: React.ReactNode
  targetRef?: React.RefObject<HTMLElement>
  position?: 'bottom' | 'top' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  offset?: number
  maxHeight?: number
  overflowScroll?: boolean
}

export default function Context({
  show,
  onClose,
  children,
  targetRef,
  position = 'bottom',
  align = 'start',
  offset = 8,
  maxHeight,
  overflowScroll = false
}: ContextProps) {
  const contextRef = useRef<HTMLDivElement>(null)
  const [styles, setStyles] = useState<React.CSSProperties>({})
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
      updatePosition()
    } else {
      setIsVisible(false)
    }
  }, [show])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        if (targetRef?.current && !targetRef.current.contains(e.target as Node)) {
          onClose()
        }
      }
    }

    const handleScroll = () => {
      if (show) {
        onClose()
      }
    }

    const handleResize = () => {
      if (show) {
        updatePosition()
      }
    }

    if (show) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [show, onClose, targetRef])

  const updatePosition = () => {
    if (!contextRef.current || !targetRef?.current) return

    const targetRect = targetRef.current.getBoundingClientRect()
    const contextRect = contextRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let top = 0
    let left = 0

    // Calculate vertical position
    switch (position) {
      case 'bottom':
        top = targetRect.bottom + offset
        // Check if it fits below, if not flip to top
        if (top + contextRect.height > viewportHeight) {
          top = targetRect.top - contextRect.height - offset
        }
        break
      case 'top':
        top = targetRect.top - contextRect.height - offset
        // Check if it fits above, if not flip to bottom
        if (top < 0) {
          top = targetRect.bottom + offset
        }
        break
      case 'left':
        top = targetRect.top
        break
      case 'right':
        top = targetRect.top
        break
    }

    // Calculate horizontal position
    switch (align) {
      case 'start':
        left = targetRect.left
        // Check if it fits on the right, if not flip to left
        if (left + contextRect.width > viewportWidth) {
          left = targetRect.right - contextRect.width
        }
        break
      case 'center':
        left = targetRect.left + (targetRect.width - contextRect.width) / 2
        // Ensure it doesn't go off screen
        if (left < 0) left = 8
        if (left + contextRect.width > viewportWidth) {
          left = viewportWidth - contextRect.width - 8
        }
        break
      case 'end':
        left = targetRect.right - contextRect.width
        // Check if it fits on the left, if not flip to right
        if (left < 0) {
          left = targetRect.left
        }
        break
    }

    setStyles({
      top: `${top}px`,
      left: `${left}px`,
      maxHeight: maxHeight ? `${maxHeight}px` : undefined
    })
  }

  if (!show) return null

  return (
    <div
      ref={contextRef}
      className={`context ${isVisible ? 'context--visible' : ''} ${overflowScroll ? 'context--overflow-scroll' : ''}`}
      style={styles}
    >
      {children}
    </div>
  )
}
