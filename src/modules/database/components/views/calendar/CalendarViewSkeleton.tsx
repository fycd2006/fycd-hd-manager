'use client'

import React from 'react'

export interface CalendarViewSkeletonProps {
  loadingText?: string
}

export const CalendarViewSkeleton: React.FC<CalendarViewSkeletonProps> = ({ loadingText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
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

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '120px', height: '22px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
          </div>
        </div>

        {loadingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#52A628' }} />
            <span>{loadingText}</span>
          </div>
        )}

        <div style={{ width: '100px', height: '28px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
      </div>

      {/* Day of Week Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          padding: '8px 0',
          textAlign: 'center',
        }}
      >
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <div key={day} style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
            {day}
          </div>
        ))}
      </div>

      {/* 5x7 Month Grid Skeletons */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(5, 1fr)',
          gap: '1px',
          backgroundColor: '#e2e8f0',
        }}
      >
        {Array.from({ length: 35 }).map((_, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#ffffff',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '14px',
                borderRadius: '3px',
                backgroundColor: '#e2e8f0',
                marginBottom: '4px',
              }}
            />
            {idx % 4 === 1 && (
              <div
                style={{
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.05}s infinite alternate`,
                }}
              />
            )}
            {idx % 5 === 2 && (
              <div
                style={{
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #dcfce7',
                  animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.05}s infinite alternate`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
