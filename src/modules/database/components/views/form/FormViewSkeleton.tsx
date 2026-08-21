'use client'

import React from 'react'

export interface FormViewSkeletonProps {
  loadingText?: string
}

export const FormViewSkeleton: React.FC<FormViewSkeletonProps> = ({ loadingText }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        padding: '30px 20px',
        userSelect: 'none',
      }}
    >
      {/* Top Brand Shimmer Line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2.5px',
          background: 'linear-gradient(90deg, #52A628 0%, #EA580C 50%, #52A628 100%)',
          backgroundSize: '200% 100%',
          animation: 'fycdBarShimmer 2s ease-in-out infinite',
        }}
      />

      {/* Form Card Skeleton */}
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Form Banner / Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
          <div style={{ width: '220px', height: '24px', borderRadius: '6px', backgroundColor: '#e2e8f0', marginBottom: '8px' }} />
          <div style={{ width: '320px', height: '14px', borderRadius: '4px', backgroundColor: '#f1f5f9' }} />
        </div>

        {/* Form Inputs List */}
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: `${80 + (idx % 3) * 25}px`, height: '14px', borderRadius: '4px', backgroundColor: '#cbd5e1' }} />
                {idx === 0 && <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }} />}
              </div>
              <div
                style={{
                  width: '100%',
                  height: '38px',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  animation: `fycdRowPulse 1.8s ease-in-out ${idx * 0.1}s infinite alternate`,
                }}
              />
            </div>
          ))}

          {/* Submit Button Placeholder */}
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '120px', height: '38px', borderRadius: '6px', backgroundColor: '#52A628', opacity: 0.7 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
