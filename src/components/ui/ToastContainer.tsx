'use client'

import React from 'react'
import { motion, AnimatePresence } from 'motion/react'
import type { Toast } from '@/modules/database/types'

interface ToastContainerProps {
  toasts: Toast[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 350, damping: 25, mass: 0.3 }}
            style={{
              pointerEvents: 'auto',
              padding: '12px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor:
                toast.type === 'error'
                  ? '#dc2626'
                  : toast.type === 'success'
                    ? '#16a34a'
                    : '#3F6212',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toast.action!.onClick()
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

