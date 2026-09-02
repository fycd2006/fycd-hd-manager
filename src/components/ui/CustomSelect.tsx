'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown, Check } from 'lucide-react'

export interface CustomSelectOption {
  value: string
  label: string
  icon?: React.ReactNode
}

export interface CustomSelectProps {
  value: string
  options: CustomSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  style?: React.CSSProperties
  width?: string | number
  disabled?: boolean
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  style,
  width = '100%',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [popoverCoords, setPopoverCoords] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return

    if (isOpen) {
      setIsOpen(false)
    } else if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropdownHeight = 200

      if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        // Render above trigger
        setPopoverCoords({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: Math.max(rect.width, 150),
        })
      } else {
        // Render below trigger
        setPopoverCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(rect.width, 150),
        })
      }
      setIsOpen(true)
    }
  }

  useEffect(() => {
    const handleScrollOrResize = (e: Event) => {
      if (
        e.type === 'scroll' &&
        e.target &&
        (
          (dropdownListRef.current && dropdownListRef.current.contains(e.target as Node)) ||
          (e.target as HTMLElement).closest?.('.custom-select-dropdown') ||
          (e.target as HTMLElement).closest?.('.custom-select-portal-root') ||
          (e.target as HTMLElement).closest?.('.toolbar-popover-card') ||
          (e.target as HTMLElement).closest?.('[data-portal-root="true"]')
        )
      ) {
        return
      }
      setIsOpen(false)
    }

    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen])

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width: typeof width === 'number' ? `${width}px` : width,
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <div
        ref={triggerRef}
        onClick={toggleOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderRadius: '10px',
          border: isOpen ? '1px solid #3F6212' : '1px solid #E7E5E4',
          backgroundColor: isOpen ? '#ffffff' : '#FAFAF9',
          boxShadow: isOpen ? '0 0 0 3px rgba(63, 98, 18, 0.12)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.18s ease',
          fontSize: '13px',
          color: selectedOption ? '#1C1917' : '#78716C',
          fontWeight: selectedOption ? 500 : 400,
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !disabled) {
            e.currentTarget.style.backgroundColor = '#ffffff'
            e.currentTarget.style.borderColor = '#D6D3D1'
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !disabled) {
            e.currentTarget.style.backgroundColor = '#FAFAF9'
            e.currentTarget.style.borderColor = '#E7E5E4'
          }
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedOption?.icon}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          color="#78716C"
          style={{
            marginLeft: '6px',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      {/* Floating Options Menu via React Portal */}
      {createPortal(
        <AnimatePresence>
          {isOpen && popoverCoords && (
            <div
              className="custom-select-portal-root"
              data-portal-root="true"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2147483640,
                backgroundColor: 'transparent',
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
              }}
            >
              <motion.div
                ref={dropdownListRef}
                key="custom-select-popover"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="custom-select-dropdown toolbar-popover-card"
                style={{
                  position: 'fixed',
                  top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
                  bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
                  left: `${popoverCoords.left}px`,
                  width: `${popoverCoords.width}px`,
                  minWidth: '150px',
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #E7E5E4',
                  boxShadow: '0 12px 28px -4px rgba(28, 25, 23, 0.12), 0 0 0 1px rgba(0,0,0,0.03)',
                  zIndex: 2147483645,
                  padding: '4px',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
                onScroll={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                {options.map((opt) => {
                  const isSelected = opt.value === value
                  return (
                    <motion.div
                      key={opt.value}
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.1 }}
                      onClick={() => {
                        onChange(opt.value)
                        setIsOpen(false)
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        backgroundColor: isSelected ? '#F4F4F5' : 'transparent',
                        color: isSelected ? '#3F6212' : '#1C1917',
                        fontWeight: isSelected ? 600 : 400,
                        transition: 'background-color 0.12s ease',
                        marginBottom: '2px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = '#FAFAF9'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.icon}
                        {opt.label}
                      </span>
                      {isSelected && <Check size={14} color="#3F6212" style={{ flexShrink: 0, marginLeft: '6px' }} />}
                    </motion.div>
                  )
                })}
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
