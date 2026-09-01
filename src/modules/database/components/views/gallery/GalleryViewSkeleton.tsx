'use client'

import React from 'react'

export interface GalleryViewSkeletonProps {
  loadingText?: string
}

export const GalleryViewSkeleton: React.FC<GalleryViewSkeletonProps> = ({ loadingText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 0,
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

      {/* Gallery Cards Grid Skeleton */}
      <div
        style={{
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '20px',
          alignContent: 'start',
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.08}s infinite alternate`,
            }}
          >
            {/* Image Placeholder */}
            <div
              style={{
                height: '140px',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
              }}
            />

            {/* Card Info */}
            <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: `${60 + (idx % 4) * 10}%`, height: '14px', borderRadius: '4px', backgroundColor: '#cbd5e1' }} />
              <div style={{ width: '40%', height: '11px', borderRadius: '3px', backgroundColor: '#e2e8f0' }} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <div style={{ width: '44px', height: '16px', borderRadius: '10px', backgroundColor: '#f1f5f9' }} />
                <div style={{ width: '52px', height: '16px', borderRadius: '10px', backgroundColor: '#f1f5f9' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
