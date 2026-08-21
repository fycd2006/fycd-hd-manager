'use client'

import React from 'react'

export interface KanbanViewSkeletonProps {
  loadingText?: string
}

export const KanbanViewSkeleton: React.FC<KanbanViewSkeletonProps> = ({ loadingText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Top Brand Shimmer Line */}
      <div
        style={{
          height: '2.5px',
          width: '100%',
          background: 'linear-gradient(90deg, #52A628 0%, #EA580C 50%, #52A628 100%)',
          backgroundSize: '200% 100%',
          animation: 'fycdBarShimmer 2s ease-in-out infinite',
        }}
      />

      {/* Optional Loading Indicator */}
      {loadingText && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#52A628' }} />
          <span>{loadingText}</span>
        </div>
      )}

      {/* Kanban Board Skeletons */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '16px',
          padding: '16px 20px',
          overflowX: 'auto',
        }}
      >
        {[0, 1, 2, 3].map((colIdx) => (
          <div
            key={colIdx}
            style={{
              width: '280px',
              minWidth: '280px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Column Header Skeleton */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
                <div style={{ width: `${80 + colIdx * 20}px`, height: '14px', borderRadius: '4px', backgroundColor: '#cbd5e1' }} />
              </div>
              <div style={{ width: '20px', height: '14px', borderRadius: '10px', backgroundColor: '#e2e8f0' }} />
            </div>

            {/* Cards Skeleton */}
            {[1, 2, 3].map((cardIdx) => (
              <div
                key={cardIdx}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                  animation: `fycdRowPulse 1.8s ease-in-out ${colIdx * 0.15 + cardIdx * 0.1}s infinite alternate`,
                }}
              >
                <div style={{ width: `${70 + (cardIdx % 3) * 10}%`, height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <div style={{ width: '48px', height: '16px', borderRadius: '10px', backgroundColor: '#f1f5f9' }} />
                  <div style={{ width: '36px', height: '16px', borderRadius: '10px', backgroundColor: '#f1f5f9' }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
