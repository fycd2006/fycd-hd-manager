'use client'

import React from 'react'

export interface TimelineViewSkeletonProps {
  loadingText?: string
}

export const TimelineViewSkeleton: React.FC<TimelineViewSkeletonProps> = ({ loadingText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '380px',
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

      {/* Toolbar Skeleton */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '110px', height: '24px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
          <div style={{ width: '130px', height: '24px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
        </div>

        {loadingText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#52A628' }} />
            <span>{loadingText}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: '60px', height: '26px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
          <div style={{ width: '60px', height: '26px', borderRadius: '6px', backgroundColor: '#e2e8f0' }} />
        </div>
      </div>

      {/* Gantt Area (Left list + Right timeline) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Row Labels */}
        <div style={{ width: '220px', borderRight: '1px solid #e2e8f0', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: '36px', borderBottom: '1px solid #e2e8f0', padding: '10px 14px' }}>
            <div style={{ width: '60px', height: '14px', borderRadius: '4px', backgroundColor: '#cbd5e1' }} />
          </div>
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} style={{ height: '44px', borderBottom: '1px solid #f1f5f9', padding: '12px 14px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: `${80 + (idx % 3) * 30}px`, height: '14px', borderRadius: '4px', backgroundColor: '#e2e8f0' }} />
            </div>
          ))}
        </div>

        {/* Right Timeline Canvas */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', overflow: 'hidden' }}>
          {/* Timeline Header (Days/Weeks) */}
          <div style={{ height: '36px', borderBottom: '1px solid #e2e8f0', display: 'flex' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ flex: 1, borderRight: '1px solid #f1f5f9', padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ width: '20px', height: '12px', margin: '0 auto', borderRadius: '2px', backgroundColor: '#e2e8f0' }} />
              </div>
            ))}
          </div>

          {/* Timeline Bars */}
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              style={{
                height: '44px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${20 + (idx * 14) % 60}%`,
                  width: `${120 + (idx * 25) % 180}px`,
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: idx % 2 === 0 ? '#f0fdf4' : '#fff7ed',
                  border: `1px solid ${idx % 2 === 0 ? '#bbf7d0' : '#fed7aa'}`,
                  animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.08}s infinite alternate`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
