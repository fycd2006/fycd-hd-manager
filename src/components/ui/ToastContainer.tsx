'use client'

import type { Toast } from '@/modules/database/types'

interface ToastContainerProps {
  toasts: Toast[]
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null

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
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: 'auto',
            padding: '12px 18px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor:
              toast.type === 'error'
                ? '#dc2626'
                : toast.type === 'success'
                  ? '#16a34a'
                  : '#3F6212',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.25)',
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
        </div>
      ))}
    </div>
  )
}

